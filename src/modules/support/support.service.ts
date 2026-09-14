import { prisma } from '../../prisma.client';

export async function createSupportTicket(userId: string | undefined, message: string, bookingId?: number) {
  if (!userId) {
    throw new Error('Invalid user ID');
  }

  const userIdNum = parseInt(userId, 10);
  const helper = await prisma.helper.findUnique({
    where: { userId: userIdNum },
    select: { id: true },
  });

  if (!helper) {
    throw new Error('Helper not found');
  }

  if (bookingId) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { helperId: true },
    });

    if (!booking || booking.helperId !== helper.id) {
      throw new Error('Booking not found or does not belong to helper');
    }
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      helperId: helper.id,
      bookingId: bookingId || null,
      message,
      status: 'OPEN',
    },
    select: {
      id: true,
      message: true,
      bookingId: true,
      status: true,
      createdAt: true,
    },
  });

  return {
    ticketId: ticket.id,
    message: ticket.message,
    bookingId: ticket.bookingId,
    status: ticket.status,
    createdAt: ticket.createdAt,
  };
}
