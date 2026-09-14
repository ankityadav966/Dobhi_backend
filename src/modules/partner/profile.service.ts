import { prisma } from '../../prisma.client';

export async function getPartnerProfile(userId: string | undefined) {
  if (!userId) {
    throw new Error('Invalid user ID');
  }

  const userIdNum = parseInt(userId, 10);

  const user = await prisma.user.findUnique({
    where: { id: userIdNum },
    select: {
      fullName: true,
      phone: true,
      avatar: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  let profile = null;
  const helper = await prisma.helper.findUnique({
    where: { userId: userIdNum },
    select: { id: true },
  });

  if (helper) {
    profile = await prisma.helperProfile.findUnique({
      where: { helperId: helper.id },
    });
  }

  return {
    fullName: user.fullName || '',
    phone: user.phone || null,
    gender: profile?.gender || null,
    experience: profile?.experienceYears || 0,
    bio: null,
    address: {
      address: profile?.address || null,
      city: profile?.city || null,
      pinCode: profile?.pinCode || null,
      latitude: profile?.latitude || 0,
      longitude: profile?.longitude || 0,
    },
  };
}

export async function updatePartnerProfile(
  userId: string | undefined,
  updates: {
    fullName?: string;
    gender?: string;
    experience?: number;
    bio?: string;
    address?: string;
    city?: string;
    pinCode?: string;
    latitude?: number;
    longitude?: number;
  },
) {
  if (!userId) {
    throw new Error('Invalid user ID');
  }

  const userIdNum = parseInt(userId, 10);

  if (updates.fullName) {
    await prisma.user.update({
      where: { id: userIdNum },
      data: {
        fullName: updates.fullName,
      },
    });
  }

  const helper = await prisma.helper.findUnique({
    where: { userId: userIdNum },
    select: { id: true },
  });

  if (helper) {
    const profileUpdateData: any = {};
    if (updates.gender !== undefined) profileUpdateData.gender = updates.gender;
    if (updates.experience !== undefined) profileUpdateData.experienceYears = updates.experience;
    if (updates.bio !== undefined) profileUpdateData.bio = updates.bio;
    if (updates.address !== undefined) profileUpdateData.address = updates.address;
    if (updates.city !== undefined) profileUpdateData.city = updates.city;
    if (updates.pinCode !== undefined) profileUpdateData.pinCode = updates.pinCode;
    if (updates.latitude !== undefined) profileUpdateData.latitude = updates.latitude;
    if (updates.longitude !== undefined) profileUpdateData.longitude = updates.longitude;

    if (Object.keys(profileUpdateData).length > 0) {
      await prisma.helperProfile.upsert({
        where: { helperId: helper.id },
        update: profileUpdateData,
        create: {
          helperId: helper.id,
          ...profileUpdateData,
        },
      });
    }
  }

  return getPartnerProfile(userId);
}
