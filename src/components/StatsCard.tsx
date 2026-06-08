import { Bug, Camera, Package, Clock, ClipboardList, AlertTriangle, Shield, AlertCircle, AlertOctagon } from 'lucide-react';

interface StatsCardProps {
  stats: {
    totalSpecimens: number;
    photographed: number;
    unphotographed: number;
    totalBoxes: number;
    totalBatches: number;
    highRiskCount: number;
    highRiskUnphotographed: number;
    protectedCount: number;
    invasiveCount: number;
    permitExpiredCount: number;
  };
}

export function StatsCard({ stats }: StatsCardProps) {
  const statItems = [
    {
      label: '标本总数',
      value: stats.totalSpecimens,
      icon: Bug,
      color: 'text-oak-700',
      bgColor: 'bg-oak-100',
    },
    {
      label: '已拍照',
      value: stats.photographed,
      icon: Camera,
      color: 'text-moss-700',
      bgColor: 'bg-moss-100',
    },
    {
      label: '待拍照',
      value: stats.unphotographed,
      icon: Clock,
      color: 'text-rust-700',
      bgColor: 'bg-rust-100',
    },
    {
      label: '展盒数量',
      value: stats.totalBoxes,
      icon: Package,
      color: 'text-oak-600',
      bgColor: 'bg-oak-200',
    },
    {
      label: '采集批次',
      value: stats.totalBatches,
      icon: ClipboardList,
      color: 'text-moss-600',
      bgColor: 'bg-moss-100',
    },
    {
      label: '高风险标本',
      value: stats.highRiskCount,
      icon: AlertTriangle,
      color: 'text-amber-700',
      bgColor: 'bg-amber-100',
    },
    {
      label: '待拍照高风险',
      value: stats.highRiskUnphotographed,
      icon: AlertOctagon,
      color: 'text-red-700',
      bgColor: 'bg-red-100',
    },
    {
      label: '保护物种',
      value: stats.protectedCount,
      icon: Shield,
      color: 'text-amber-700',
      bgColor: 'bg-amber-100',
    },
    {
      label: '外来物种',
      value: stats.invasiveCount,
      icon: AlertCircle,
      color: 'text-red-700',
      bgColor: 'bg-red-100',
    },
    {
      label: '许可过期',
      value: stats.permitExpiredCount,
      icon: Clock,
      color: 'text-rust-700',
      bgColor: 'bg-rust-100',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-5 gap-4">
      {statItems.map((item, index) => (
        <div
          key={item.label}
          className="card p-4 flex items-center gap-4 opacity-0 animate-fade-in-up"
          style={{ animationDelay: `${index * 0.1}s` }}
        >
          <div className={`w-12 h-12 rounded-lg ${item.bgColor} flex items-center justify-center flex-shrink-0`}>
            <item.icon className={`w-6 h-6 ${item.color}`} />
          </div>
          <div className="min-w-0">
            <p className="text-oak-500 text-sm font-sans">{item.label}</p>
            <p className={`text-2xl font-semibold font-serif ${item.color}`}>
              {item.value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
