/**
 * Browser-compatible subset of SVGO types
 * Extracted from https://github.com/svg/svgo/blob/main/lib/types.ts
 */

export type PathDataCommand =
  | 'M'
  | 'm'
  | 'Z'
  | 'z'
  | 'L'
  | 'l'
  | 'H'
  | 'h'
  | 'V'
  | 'v'
  | 'C'
  | 'c'
  | 'S'
  | 's'
  | 'Q'
  | 'q'
  | 'T'
  | 't'
  | 'A'
  | 'a';

export type PathDataItem = {
  command: PathDataCommand;
  args: number[];
};

export type XastElement = {
  type: 'element';
  name: string;
  attributes: Record<string, string>;
  children: XastChild[];
};

export type XastDoctype = {
  type: 'doctype';
  name: string;
  data: {
    doctype: string;
  };
};

export type XastInstruction = {
  type: 'instruction';
  name: string;
  value: string;
};

export type XastComment = {
  type: 'comment';
  value: string;
};

export type XastCdata = {
  type: 'cdata';
  value: string;
};

export type XastText = {
  type: 'text';
  value: string;
};

export type XastChild =
  | XastDoctype
  | XastInstruction
  | XastComment
  | XastCdata
  | XastText
  | XastElement;

export type XastRoot = {
  type: 'root';
  children: XastChild[];
};

export type XastParent = XastRoot | XastElement;

export type StaticStyle = {
  type: 'static';
  inherited: boolean;
  value: string;
};

export type DynamicStyle = {
  type: 'dynamic';
  inherited: boolean;
};

export type ComputedStyles = Record<string, StaticStyle | DynamicStyle>;

export type StringifyPathDataOptions = {
  pathData: ReadonlyArray<PathDataItem>;
  precision?: number;
  disableSpaceAfterFlags?: boolean;
};
