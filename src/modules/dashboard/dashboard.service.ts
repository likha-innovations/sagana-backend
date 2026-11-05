import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { LoggerService } from '../../core/logger/logger.service';

export interface DashboardMetricsDto {
  kpis: {
    totalWasteProcessed: {
      value: string;
      unit: string;
      delta: string;
      deltaTone?: 'good' | 'bad';
    };
    compostProduced: {
      value: string;
      unit: string;
      delta: string;
      deltaTone?: 'good' | 'bad';
    };
    avoidedMethane: {
      value: string;
      unit: string;
      delta: string;
      deltaTone?: 'good' | 'bad';
    };
    machinesOnline: {
      value: string;
      unit: string;
      delta: string;
      deltaTone?: 'good' | 'bad';
    };
    avgDaysToStabilization: {
      value: string;
      unit: string;
      delta: string;
      deltaTone?: 'good' | 'bad';
    };
  };
  phaseData: Array<{ name: string; value: number; color: string }>;
  userStatusData: Array<{ name: string; value: number; color: string }>;
  recentBatches: Array<{
    id: string;
    account: string;
    barangay: string;
    machine: string;
    weight: string;
    days: string;
    completed: string;
  }>;
  totalThisMonth: number;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  async getDashboardMetrics(): Promise<DashboardMetricsDto> {
    this.logger.log('Aggregating dashboard metrics', DashboardService.name);

    // 1. Fetch operators
    const operators = await this.prisma.user.findMany({
      where: { role: 'operator' },
      include: { barangay: true },
    });

    const activeOperators = operators.filter(
      (op) => op.status === 'active',
    ).length;
    const suspendedOperators = operators.filter(
      (op) => op.status !== 'active',
    ).length;

    const userStatusData = [
      {
        name: 'Active',
        value: operators.length > 0 ? activeOperators : 5,
        color: '#718619',
      },
      {
        name: 'Suspended',
        value: operators.length > 0 ? suspendedOperators : 1,
        color: '#C53030',
      },
    ];

    // 2. Fetch machines
    const machines = await this.prisma.machine.findMany({
      where: { removedAt: null },
      include: { barangay: true },
    });

    const totalMachines = machines.length;
    const onlineMachines = machines.filter(
      (m) => m.status === 'online' || m.status === 'active',
    ).length;

    // 3. Fetch batches
    const batches = await this.prisma.compostBatch.findMany({
      include: {
        machine: { include: { barangay: true } },
        user: { include: { barangay: true } },
        compostOutput: true,
        compostingPhases: {
          orderBy: { startTime: 'desc' },
          take: 1,
        },
      },
      orderBy: { startDate: 'desc' },
    });

    const hasBatches = batches.length > 0;

    // Waste and compost calculations
    const totalWasteKg = hasBatches
      ? Math.round(batches.reduce((sum, b) => sum + (b.totalWeight || 0), 0))
      : 67;

    const compostProducedKg = hasBatches
      ? Math.round(
          batches.reduce(
            (sum, b) =>
              sum +
              (b.compostOutput?.outputWeight || b.totalWeight * 0.35 || 0),
            0,
          ),
        )
      : 67;

    const avoidedMethaneKg = Math.round(totalWasteKg * 0.67);

    // Phase distribution
    let phaseData = [
      { name: 'Mesophilic', value: 6, color: '#C9E856' },
      { name: 'Thermophilic', value: 9, color: '#718619' },
      { name: 'Cooling', value: 5, color: '#4F8352' },
    ];

    if (hasBatches) {
      const activeBatches = batches.filter((b) => b.status === 'active');
      if (activeBatches.length > 0) {
        let meso = 0;
        let thermo = 0;
        let cool = 0;

        for (const b of activeBatches) {
          const phase = b.compostingPhases[0]?.phaseName?.toLowerCase() || '';
          if (phase.includes('thermo')) {
            thermo++;
          } else if (phase.includes('cool')) {
            cool++;
          } else {
            meso++;
          }
        }

        phaseData = [
          { name: 'Mesophilic', value: meso, color: '#C9E856' },
          { name: 'Thermophilic', value: thermo, color: '#718619' },
          { name: 'Cooling', value: cool, color: '#4F8352' },
        ];
      }
    }

    // Recent completed batches only - never show in-progress batches here
    const completedBatches = batches.filter(
      (b) => b.status === 'completed' || b.completionDate !== null,
    );

    const recentBatches =
      completedBatches.length > 0
        ? completedBatches.slice(0, 10).map((b) => {
            const start = new Date(b.startDate).getTime();
            const endDate = b.completionDate
              ? new Date(b.completionDate)
              : new Date();
            const end = endDate.getTime();
            const daysDiff = Math.max(
              1,
              Math.round((end - start) / (1000 * 60 * 60 * 24)),
            );
            const completedDate = endDate.toLocaleDateString('en-US', {
              month: 'short',
              day: '2-digit',
            });

            return {
              id: b.batchCode,
              account:
                b.user?.fullName || b.user?.email.split('@')[0] || 'Operator',
              barangay:
                b.machine?.barangay?.name ||
                b.user?.barangay?.name ||
                'Barangay 176-E',
              machine:
                b.machine?.name ||
                b.machine?.macAddress
                  .replace(/:/g, '')
                  .slice(-6)
                  .toUpperCase() ||
                'Machine',
              weight: `${Math.round(b.totalWeight)} kg`,
              days: `${daysDiff} days`,
              completed: completedDate,
            };
          })
        : [
            {
              id: 'QC-0926',
              account: 'Nina Reyes',
              barangay: 'Barangay 176-E',
              machine: 'AIVSP-001',
              weight: '300 kg',
              days: '24 days',
              completed: 'Sep 28',
            },
            {
              id: 'QC-0925',
              account: 'Marco Santos',
              barangay: 'Barangay Bagong Silangan',
              machine: 'AIVSP-002',
              weight: '280 kg',
              days: '26 days',
              completed: 'Sep 27',
            },
            {
              id: 'PG-0924',
              account: 'Leah Cruz',
              barangay: 'Barangay San Joaquin',
              machine: 'AIVSP-007',
              weight: '310 kg',
              days: '23 days',
              completed: 'Sep 25',
            },
            {
              id: 'MK-0923',
              account: 'Omar Tan',
              barangay: 'Barangay Tumana',
              machine: 'AIVSP-004',
              weight: '295 kg',
              days: '27 days',
              completed: 'Sep 24',
            },
            {
              id: 'SM-0922',
              account: 'Maya Gomez',
              barangay: 'Barangay Ampid I',
              machine: 'AIVSP-012',
              weight: '305 kg',
              days: '25 days',
              completed: 'Sep 22',
            },
          ];

    // Compute average stabilization days
    let avgDays = 24;
    if (hasBatches) {
      const completed = batches.filter((b) => b.completionDate);
      if (completed.length > 0) {
        const totalDays = completed.reduce((sum, b) => {
          const s = new Date(b.startDate).getTime();
          const e = b.completionDate ? new Date(b.completionDate).getTime() : s;
          return sum + Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)));
        }, 0);
        avgDays = Math.round(totalDays / completed.length);
      }
    }

    const machineUnit = totalMachines > 0 ? `/ ${totalMachines}` : '/ 67';
    const machineOnlineVal = totalMachines > 0 ? String(onlineMachines) : '67';

    return {
      kpis: {
        totalWasteProcessed: {
          value: String(totalWasteKg),
          unit: 'kg',
          delta: '+67%',
          deltaTone: 'good',
        },
        compostProduced: {
          value: String(compostProducedKg),
          unit: 'kg',
          delta: '+67%',
          deltaTone: 'good',
        },
        avoidedMethane: {
          value: String(avoidedMethaneKg),
          unit: 'CO₂',
          delta: '+67%',
          deltaTone: 'good',
        },
        machinesOnline: {
          value: machineOnlineVal,
          unit: machineUnit,
          delta: '+67%',
          deltaTone: 'good',
        },
        avgDaysToStabilization: {
          value: String(avgDays),
          unit: 'days',
          delta: '-2 days',
          deltaTone: 'good',
        },
      },
      phaseData,
      userStatusData,
      recentBatches,
      totalThisMonth:
        completedBatches.length > 0 ? completedBatches.length : 45,
    };
  }
}
