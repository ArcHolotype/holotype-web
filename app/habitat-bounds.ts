type Point = {x:number;y:number};
export type ViewRect = {left:number;top:number;right:number;bottom:number};
export type HabitatBounds = {minX:number;maxX:number;minY:number;maxY:number;magnification:number;inset:number};

/** Covers both wings at every heading, flight lift, glow and the unrotated name. */
export const SPECIMEN_RADIUS = 62 * 1.25;
/** Body core only: the roam margin keeps the torso inside and lets wingtips sweep the glass. */
export const ROAM_RADIUS = 40;
export function habitatBounds(width:number,height:number,zoom:number,pan:Point,visible?:ViewRect):HabitatBounds {
  const rect=visible??{left:0,top:0,right:width,bottom:height};
  const edge=12;
  const room=Math.min(rect.right-rect.left,rect.bottom-rect.top)/2-edge;
  const base=Math.min(1.2,Math.max(.85,width/900));
  // Only fit the specimen down when the viewport cannot contain its enlarged wings.
  const magnification=Math.max(.01,Math.min(base,(room/zoom-12)/SPECIMEN_RADIUS));
  const inset=(SPECIMEN_RADIUS*magnification+12)*zoom+edge;
  // The flight area is the full outer frame and never shrinks with zoom: zoom is only a camera.
  // A zoomed-in specimen may glide out of view instead of bouncing inside a collapsing sliver,
  // which is what made the heading whipsaw 180° at high magnification.
  const roomFull=Math.min(width,height)/2-edge;
  const mag1=Math.max(.01,Math.min(base,(roomFull-12)/SPECIMEN_RADIUS));
  // Roam area is the whole pane minus a body-core margin (not the full wingspan):
  // the old wingspan margin left a band in the middle that read as a box inside the glass.
  const marginX=(ROAM_RADIUS*mag1+edge)/width;
  const marginY=(ROAM_RADIUS*mag1+edge)/height;
  return {
    minX:marginX,maxX:1-marginX,
    minY:marginY,maxY:1-marginY,
    magnification,inset,
  };
}

export function constrainToHabitat<T extends Point & {vx:number;vy:number}>(fly:T,b:HabitatBounds):void {
  if(fly.x<b.minX){fly.x=b.minX;if(fly.vx<0)fly.vx=-fly.vx*.6;}
  if(fly.x>b.maxX){fly.x=b.maxX;if(fly.vx>0)fly.vx=-fly.vx*.6;}
  if(fly.y<b.minY){fly.y=b.minY;if(fly.vy<0)fly.vy=-fly.vy*.6;}
  if(fly.y>b.maxY){fly.y=b.maxY;if(fly.vy>0)fly.vy=-fly.vy*.6;}
}
