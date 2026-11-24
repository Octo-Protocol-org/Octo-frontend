import React, { useState } from 'react';

interface PasswordToggleProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

export const PasswordToggle: React.FC<PasswordToggleProps> = ({
  id,
  name,
  value,
  onChange,
  placeholder = 'Password',
  className = '',
  required = false
}) => {
  const [show, setShow] = useState(false);

  return (
    <div className={`relative flex items-center ${className}`}>
      <input
        id={id}
        name={name}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="w-full pr-10 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute right-2 text-gray-500 hover:text-gray-700 p-1"
      >
        {show ? 'Hide' : 'Show'}
      </button>
    </div>
  );
};
