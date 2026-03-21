/**
 * Input Validation & Sanitization Utilities
 * Security: Prevents XSS, injection attacks, and data corruption
 */

/**
 * Validates if a string is a valid HTTP/HTTPS URL
 * @param url - The URL string to validate
 * @returns true if valid, false otherwise
 */
export const validateUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
};

/**
 * Sanitizes user input by trimming and limiting length
 * @param input - The input string to sanitize
 * @param maxLength - Maximum allowed length (default: 1000)
 * @returns Sanitized string
 */
export const sanitizeInput = (input: string, maxLength: number = 1000): string => {
  return input.trim().slice(0, maxLength);
};

/**
 * Validates email format (basic check)
 * @param email - The email string to validate
 * @returns true if valid email format, false otherwise
 */
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Sanitizes HTML to prevent XSS attacks
 * @param html - The HTML string to sanitize
 * @returns Sanitized string with HTML entities encoded
 */
export const sanitizeHtml = (html: string): string => {
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
};

/**
 * Validates that input only contains alphanumeric characters and common punctuation
 * @param input - The input string to validate
 * @returns true if safe, false otherwise
 */
export const validateAlphanumeric = (input: string): boolean => {
  const safePattern = /^[a-zA-Z0-9\s\-_.,!?'"]+$/;
  return safePattern.test(input);
};

/**
 * Truncates text to a maximum length with ellipsis
 * @param text - The text to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated text with ellipsis if needed
 */
export const truncateText = (text: string, maxLength: number = 200): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};
