import React from 'react';
import * as Icons from 'lucide-react';

interface LucideIconProps {
  name: string;
  className?: string;
  size?: number;
}

export default function LucideIcon({ name, className = '', size = 20 }: LucideIconProps) {
  // Map specific user-configured names to accurate Lucide-react components
  let componentName = name;
  if (name === 'Heading1' || name === 'Minimize2') {
    componentName = 'Minimize2';
  } else if (name === 'Signature') {
    componentName = 'PenTool';
  }

  const IconComponent = (Icons as any)[componentName];

  if (!IconComponent) {
    // Return a default document icon as fallback
    return <Icons.File className={className} size={size} />;
  }

  return <IconComponent className={className} size={size} />;
}
