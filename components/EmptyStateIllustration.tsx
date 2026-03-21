import React from 'react';

export const NoLinksIllustration: React.FC = () => (
  <svg
    width="200"
    height="200"
    viewBox="0 0 200 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="mx-auto mb-6 opacity-40"
  >
    {/* Bookmark shape */}
    <path
      d="M60 40C60 35.5817 63.5817 32 68 32H132C136.418 32 140 35.5817 140 40V168L100 148L60 168V40Z"
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
    />
    {/* Plus sign */}
    <line x1="100" y1="80" x2="100" y2="120" stroke="currentColor" strokeWidth="2" />
    <line x1="80" y1="100" x2="120" y2="100" stroke="currentColor" strokeWidth="2" />
  </svg>
);

export const NoResultsIllustration: React.FC = () => (
  <svg
    width="200"
    height="200"
    viewBox="0 0 200 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="mx-auto mb-6 opacity-40"
  >
    {/* Magnifying glass */}
    <circle cx="85" cy="85" r="40" stroke="currentColor" strokeWidth="2" />
    <line x1="115" y1="115" x2="145" y2="145" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    {/* X mark */}
    <line x1="70" y1="70" x2="100" y2="100" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="100" y1="70" x2="70" y2="100" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const NoCategoriesIllustration: React.FC = () => (
  <svg
    width="200"
    height="200"
    viewBox="0 0 200 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="mx-auto mb-6 opacity-40"
  >
    {/* Folder shape */}
    <path
      d="M40 60C40 55.5817 43.5817 52 48 52H88L100 64H152C156.418 64 160 67.5817 160 72V140C160 144.418 156.418 148 152 148H48C43.5817 148 40 144.418 40 140V60Z"
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
    />
    {/* Plus sign */}
    <line x1="100" y1="90" x2="100" y2="130" stroke="currentColor" strokeWidth="2" />
    <line x1="80" y1="110" x2="120" y2="110" stroke="currentColor" strokeWidth="2" />
  </svg>
);
