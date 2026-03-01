import { Request, Response } from 'express';
import prisma from '../lib/prisma';

export const identify = async (req: Request, res: Response): Promise<void> => {
  const { email, phoneNumber } = req.body;

  // Validate: at least one field must be present
  if (!email && !phoneNumber) {
    res.status(400).json({ error: 'email or phoneNumber is required' });
    return;
  }

  const phoneStr = phoneNumber ? String(phoneNumber) : null;

  // Step 1: Find ALL existing contacts matching email OR phoneNumber
  const matchingContacts = await prisma.contact.findMany({
    where: {
      deletedAt: null,
      OR: [
        email ? { email } : {},
        phoneStr ? { phoneNumber: phoneStr } : {},
      ],
    },
    orderBy: { createdAt: 'asc' },
  });

  // Step 2: NEW CUSTOMER — no matches at all
  if (matchingContacts.length === 0) {
    const newContact = await prisma.contact.create({
      data: {
        email: email ?? null,
        phoneNumber: phoneStr ?? null,
        linkPrecedence: 'primary',
        linkedId: null,
      },
    });

    res.status(200).json({
      contact: {
        primaryContatctId: newContact.id,
        emails: newContact.email ? [newContact.email] : [],
        phoneNumbers: newContact.phoneNumber ? [newContact.phoneNumber] : [],
        secondaryContactIds: [],
      },
    });
    return;
  }

  // Step 3: Collect all root primary IDs from matching contacts
  const primaryIds = new Set<number>();

  for (const contact of matchingContacts) {
    if (contact.linkPrecedence === 'primary') {
      primaryIds.add(contact.id);
    } else if (contact.linkedId) {
      primaryIds.add(contact.linkedId);
    }
  }

  // Step 4: Fetch the actual primary contact rows
  const primaryContacts = await prisma.contact.findMany({
    where: {
      id: { in: Array.from(primaryIds) },
      deletedAt: null,
    },
    orderBy: { createdAt: 'asc' },
  });

  // Step 5: MERGE — if more than one primary found, older one wins
  if (primaryContacts.length > 1) {
    const truePrimary = primaryContacts[0];   // oldest = true primary
    const toMerge = primaryContacts.slice(1); // all newer primaries become secondary

    for (const contact of toMerge) {
      // Demote the newer primary itself to secondary
      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          linkPrecedence: 'secondary',
          linkedId: truePrimary.id,
          updatedAt: new Date(),
        },
      });

      // Re-link all of the demoted primary's secondaries to the true primary
      await prisma.contact.updateMany({
        where: {
          linkedId: contact.id,
          deletedAt: null,
        },
        data: {
          linkedId: truePrimary.id,
          updatedAt: new Date(),
        },
      });
    }
  }

  // Step 6: Identify the single true primary
  const truePrimary = primaryContacts[0];

  // Step 7: Check if incoming info is new
  const allRelatedContacts = await prisma.contact.findMany({
    where: {
      deletedAt: null,
      OR: [
        { id: truePrimary.id },
        { linkedId: truePrimary.id },
      ],
    },
    orderBy: { createdAt: 'asc' },
  });

  const allEmails = new Set(allRelatedContacts.map((c) => c.email).filter(Boolean));
  const allPhones = new Set(allRelatedContacts.map((c) => c.phoneNumber).filter(Boolean));

  const isNewEmail = email && !allEmails.has(email);
  const isNewPhone = phoneStr && !allPhones.has(phoneStr);

  // Step 8: SECONDARY CONTACT — new information detected
  if (isNewEmail || isNewPhone) {
    await prisma.contact.create({
      data: {
        email: email ?? null,
        phoneNumber: phoneStr ?? null,
        linkPrecedence: 'secondary',
        linkedId: truePrimary.id,
      },
    });
  }

  // Step 9: Fetch final consolidated state
  const finalContacts = await prisma.contact.findMany({
    where: {
      deletedAt: null,
      OR: [
        { id: truePrimary.id },
        { linkedId: truePrimary.id },
      ],
    },
    orderBy: { createdAt: 'asc' },
  });

  const secondaryContacts = finalContacts.filter((c) => c.linkPrecedence === 'secondary');

  const emails = [
    truePrimary.email,
    ...secondaryContacts
      .map((c) => c.email)
      .filter((e) => e && e !== truePrimary.email),
  ].filter(Boolean) as string[];

  const phoneNumbers = [
    truePrimary.phoneNumber,
    ...secondaryContacts
      .map((c) => c.phoneNumber)
      .filter((p) => p && p !== truePrimary.phoneNumber),
  ].filter(Boolean) as string[];

  res.status(200).json({
    contact: {
      primaryContatctId: truePrimary.id,
      emails,
      phoneNumbers,
      secondaryContactIds: secondaryContacts.map((c) => c.id),
    },
  });
};