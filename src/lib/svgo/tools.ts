/**
 * Browser-compatible subset of SVGO tools
 * Extracted from https://github.com/svg/svgo/blob/main/lib/svgo/tools.js
 */

/**
 * Round a number to a given precision.
 * @param num - The number to round
 * @param precision - Number of decimal places
 * @returns The rounded number
 */
export const toFixed = (num: number, precision: number): number => {
  const pow = 10 ** precision;
  return Math.round(num * pow) / pow;
};

/**
 * Remove floating-point numbers leading zero.
 * @param value - The number to format
 * @returns String with leading zero removed
 * @example
 * 0.5 → .5
 * -0.5 → -.5
 */
export const removeLeadingZero = (value: number): string => {
  const strValue = value.toString();

  if (0 < value && value < 1 && strValue.startsWith('0')) {
    return strValue.slice(1);
  }

  if (-1 < value && value < 0 && strValue[1] === '0') {
    return strValue[0] + strValue.slice(2);
  }

  return strValue;
};

const regReferencesUrl = /\burl\((["'])?#(.+?)\1\)/g;

/**
 * Check if a string contains a URL reference like url(#gradient001)
 * @param body - String to check
 * @returns If the given string includes a URL reference.
 */
export const includesUrlReference = (body: string): boolean => {
  return new RegExp(regReferencesUrl).test(body);
};
