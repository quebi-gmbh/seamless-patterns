/**
 * Browser-compatible path merging utility
 * Based on SVGO's mergePaths plugin but simplified for direct use
 */
import { parsePathData, stringifyPathData } from './path';
import { intersects } from './_path';
import type { PathDataItem } from './types';

export interface MergePathsOptions {
  /** Force merge even if paths intersect */
  force?: boolean;
  /** Precision for floating point numbers */
  floatPrecision?: number;
  /** Disable space after arc flags */
  noSpaceAfterFlags?: boolean;
}

/**
 * Merge multiple SVG path d attributes into one.
 *
 * @param pathStrings - Array of SVG path d attribute strings
 * @param options - Merge options
 * @returns Merged path d attribute string, or null if merge failed
 */
export function mergePathStrings(
  pathStrings: string[],
  options: MergePathsOptions = {}
): string | null {
  console.log('[mergePathStrings] Input:', pathStrings.length, 'paths');

  const {
    force = true,
    floatPrecision = 3,
    noSpaceAfterFlags = false,
  } = options;

  if (pathStrings.length === 0) {
    console.log('[mergePathStrings] No paths provided');
    return null;
  }

  if (pathStrings.length === 1) {
    console.log('[mergePathStrings] Only one path, returning as-is');
    return pathStrings[0];
  }

  // Parse all path strings into PathDataItem arrays
  const allPathData: PathDataItem[][] = [];
  for (let i = 0; i < pathStrings.length; i++) {
    const pathString = pathStrings[i];
    console.log(`[mergePathStrings] Parsing path ${i}:`, pathString.substring(0, 50) + '...');
    try {
      const parsed = parsePathData(pathString);
      console.log(`[mergePathStrings] Parsed path ${i}:`, parsed.length, 'commands');
      if (parsed.length === 0) {
        console.log(`[mergePathStrings] Path ${i} parsed to empty array, skipping`);
        continue;
      }
      // Ensure first moveto is absolute
      if (parsed[0].command === 'm') {
        parsed[0].command = 'M';
      }
      allPathData.push(parsed);
    } catch (error) {
      console.error(`[mergePathStrings] Error parsing path ${i}:`, error);
    }
  }

  console.log('[mergePathStrings] Successfully parsed paths:', allPathData.length);

  if (allPathData.length === 0) {
    console.log('[mergePathStrings] No valid parsed paths');
    return null;
  }

  // Merge all paths
  let mergedPathData: PathDataItem[] = [...allPathData[0]];
  console.log('[mergePathStrings] Starting merge with', mergedPathData.length, 'commands from first path');

  for (let i = 1; i < allPathData.length; i++) {
    const currentPathData = allPathData[i];

    // Check if we can merge (force or no intersection)
    if (!force && intersects(mergedPathData, currentPathData)) {
      console.log(`[mergePathStrings] Path ${i} intersects, skipping (force=${force})`);
      continue;
    }

    // Concatenate the path data
    mergedPathData = [...mergedPathData, ...currentPathData];
    console.log(`[mergePathStrings] Added path ${i}, total commands:`, mergedPathData.length);
  }

  console.log('[mergePathStrings] Final merged path has', mergedPathData.length, 'commands');

  // Stringify the merged path data
  try {
    const result = stringifyPathData({
      pathData: mergedPathData,
      precision: floatPrecision,
      disableSpaceAfterFlags: noSpaceAfterFlags,
    });
    console.log('[mergePathStrings] Stringified result:', result?.substring(0, 50) + '...');
    return result;
  } catch (error) {
    console.error('[mergePathStrings] Error stringifying:', error);
    return null;
  }
}

/**
 * Merge path data items directly (already parsed)
 */
export function mergePathData(
  pathDataArrays: PathDataItem[][],
  options: MergePathsOptions = {}
): PathDataItem[] {
  const { force = true } = options;

  if (pathDataArrays.length === 0) {
    return [];
  }

  let mergedPathData: PathDataItem[] = [...pathDataArrays[0]];

  for (let i = 1; i < pathDataArrays.length; i++) {
    const currentPathData = pathDataArrays[i];

    if (!force && intersects(mergedPathData, currentPathData)) {
      continue;
    }

    mergedPathData = [...mergedPathData, ...currentPathData];
  }

  return mergedPathData;
}
