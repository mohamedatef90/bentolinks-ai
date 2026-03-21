import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles = {
  primary: `
    bg-[#c1ff00] text-black font-semibold
    hover:bg-[#d4ff33] hover:shadow-lg hover:shadow-[#c1ff00]/20
    active:scale-95
    disabled:opacity-50 disabled:cursor-not-allowed
    transition-all duration-300
  `,
  secondary: `
    bg-zinc-800 text-white
    hover:bg-zinc-700 hover:border-zinc-600
    border border-zinc-700
    transition-all duration-300
  `,
  ghost: `
    bg-transparent text-gray-400
    hover:bg-zinc-800 hover:text-white
    transition-all duration-300
  `,
  danger: `
    bg-red-600 text-white
    hover:bg-red-700 hover:shadow-lg
    transition-all duration-300
  `,
};

const sizeStyles = {
  sm: 'px-3 py-1.5 text-sm min-h-[36px]',
  md: 'px-4 py-2 text-base min-h-[44px]',
  lg: 'px-6 py-3 text-lg min-h-[52px]',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  return (
    <button
      className={`
        rounded-lg font-medium
        flex items-center justify-center gap-2
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle 
            className="opacity-25" 
            cx="12" 
            cy="12" 
            r="10" 
            stroke="currentColor" 
            strokeWidth="4" 
            fill="none" 
          />
          <path 
            className="opacity-75" 
            fill="currentColor" 
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" 
          />
        </svg>
      )}
      {!isLoading && leftIcon && leftIcon}
      {children}
      {rightIcon && rightIcon}
    </button>
  );
};
