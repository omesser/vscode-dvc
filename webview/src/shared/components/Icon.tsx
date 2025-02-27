import React, { SVGProps } from 'react'

export type IconValue = (props: SVGProps<SVGSVGElement>) => JSX.Element
interface IconProps {
  icon: IconValue
  className?: string
  width?: number
  height?: number
}

export const Icon: React.FC<IconProps> = ({
  icon,
  width,
  height,
  ...other
}) => {
  const I = icon
  const w = width || 20
  const h = height || 20

  return <I width={w} height={h} {...other} />
}
