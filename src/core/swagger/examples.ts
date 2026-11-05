import { ApiResponse } from '@nestjs/swagger';

const timestamp = '2026-10-10T00:00:00.000Z';

export const successExample = (data: unknown) => ({
  success: true,
  data,
  timestamp,
});

export const ApiErrorExample = (
  status: number,
  description: string,
  message: string,
) =>
  ApiResponse({
    status,
    description,
    content: {
      'application/json': {
        example: { success: false, statusCode: status, message, timestamp },
      },
    },
  });

export const barangayExample = { id: 'barangay123', name: 'Sample Barangay' };

export const profileExample = {
  id: 'user123',
  barangayId: 'barangay123',
  fullName: 'Juan Dela Cruz',
  birthday: null,
  email: 'juan@example.com',
  role: 'operator',
  status: 'active',
  verificationStatus: 'unverified',
  createdAt: timestamp,
  barangay: { ...barangayExample, status: 'active', createdAt: timestamp },
};

export const machineExample = {
  id: 'machine123',
  barangayId: 'barangay123',
  macAddress: 'AA:BB:CC:DD:EE:FF',
  name: 'Composter 1',
  status: 'active',
  wifiSsid: 'SaganaNet',
  lastSeen: null,
  createdAt: timestamp,
  removedAt: null,
};

export const barangayCodeBody = {
  type: 'object' as const,
  required: ['code'],
  properties: {
    code: {
      type: 'string' as const,
      example: 'ABC123',
      description:
        'Six letters or digits; whitespace is trimmed and letters are case-insensitive.',
    },
  },
};
