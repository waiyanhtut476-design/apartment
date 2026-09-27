import { Room } from '../types';

/**
 * 6 Floors, 11 Rooms per floor = 66 Rooms Total
 * Floors 1 to 4: 1,700 Baht
 * Floors 5 to 6: 1,200 Baht
 * All 66 rooms are completely VACANT/AVAILABLE by default as requested by Landlord.
 */
function generateAllVacant66Rooms(): Room[] {
  const rooms: Room[] = [];

  for (let floor = 1; floor <= 6; floor++) {
    const rent = floor <= 4 ? 1700 : 1200;

    for (let r = 1; r <= 11; r++) {
      const roomNumStr = r < 10 ? `0${r}` : `${r}`;
      const roomNumber = `${floor}${roomNumStr}`;
      const id = `room-${roomNumber}`;

      rooms.push({
        id,
        roomNumber,
        floor,
        roomType: '1 Bedroom',
        monthlyRent: rent,
        currency: 'Baht',
        status: 'available',
        tenantName: null,
        notes: 'အခန်းအလွတ် (အသင့်ငှားရမ်းနိုင်သည်)',
        isTenantCheckedIn: false,
      });
    }
  }

  return rooms;
}

export const INITIAL_ROOMS: Room[] = generateAllVacant66Rooms();
