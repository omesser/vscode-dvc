import { DetailedHTMLProps, HTMLAttributes } from 'react'

export const withScale = (scale: number) =>
  ({ '--scale': scale } as DetailedHTMLProps<
    HTMLAttributes<HTMLDivElement>,
    HTMLDivElement
  >)

export const withVariant = (variant: number) =>
  ({ '--variant': variant } as DetailedHTMLProps<
    HTMLAttributes<HTMLDivElement>,
    HTMLDivElement
  >)

export enum ThemeProperty {
  BACKGROUND_COLOR = '--vscode-editor-background',
  FOREGROUND_COLOR = '--vscode-editor-foreground',
  MENU_BACKGROUND = '--vscode-menu-background',
  ACCENT_COLOR = '--button-primary-background'
}

export const getThemeValue = (property: ThemeProperty) =>
  getComputedStyle(document.documentElement).getPropertyValue(property).trim()

export const alphaToHex = (color: string, alpha: number): string => {
  const fullColor: string = color.length === 4 ? color + color.slice(-3) : color
  return `${fullColor}${(Math.round(alpha * 255) + 0x10000)
    .toString(16)
    .slice(-2)}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return
export const getStyleProperty = (propAsString: string) => propAsString as any

export const hexToRGB = (hex: string) =>
  `rgb(${Number.parseInt(hex.slice(1, 3), 16)}, ${Number.parseInt(
    hex.slice(4, 6),
    16
  )}, ${Number.parseInt(hex.slice(-2), 16)})`
