declare module 'components/tokens' {
  export interface RadiusScale { xs:number; sm:number; md:number; lg:number; xl:number }
  export interface SpacingScale { xs:number; sm:number; md:number; lg:number; xl:number }
  export interface Colors { primary:string; text:string; [k:string]: any }
  export interface Shadows { [k:string]: any }
  const tokens: {
    spacing: SpacingScale;
    radius: RadiusScale;
    colors: Colors;
    shadows: Shadows;
    r?: RadiusScale;
    s?: SpacingScale;
    [k:string]: any;
  };
  export default tokens;
}
