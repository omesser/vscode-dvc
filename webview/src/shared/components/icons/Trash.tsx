import * as React from 'react'

function SvgTrash(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="currentColor"
        d="M10.0002 3H12.0002H13.0002V4H12.0002V13L11.0002 14H4.00024L3.00024 13V4H2.00024V3H5.00024V2C5.00024 1.73478 5.10555 1.48038 5.29309 1.29285C5.48063 1.10531 5.73503 1 6.00024 1H9.00024C9.26546 1 9.51986 1.10531 9.7074 1.29285C9.89493 1.48038 10.0002 1.73478 10.0002 2V3ZM9.00024 2H6.00024V3H9.00024V2ZM4.00024 13H11.0002V4H4.00024V13ZM6.00024 5H5.00024V12H6.00024V5ZM7.00024 5H8.00024V12H7.00024V5ZM9.00024 5H10.0002V12H9.00024V5Z"
      />
    </svg>
  )
}

export default SvgTrash
