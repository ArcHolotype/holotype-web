import test from 'node:test';
import assert from 'node:assert/strict';
import { habitatBounds, constrainToHabitat, ROAM_RADIUS } from '../app/habitat-bounds.ts';

test('flight bounds stay a healthy full-frame box and never collapse when zoomed',()=>{
  let checked=0;
  for(const [w,h] of [[280,540],[393,567],[1280,630],[1920,1080]]){
    const base=habitatBounds(w,h,1,{x:0,y:0});
    for(const zoom of [.65,1,1.6,2.6]){
      for(const pan of [{x:0,y:0},{x:w*.6,y:-h*.6},{x:-w*.6,y:h*.6}]){
        for(const visible of [{left:0,top:0,right:w,bottom:h},{left:0,top:70,right:w,bottom:h-90}]){
          const b=habitatBounds(w,h,zoom,pan,visible);
          assert.ok(b.minX<=b.maxX&&b.minY<=b.maxY);
          assert.ok(b.minX>=0&&b.maxX<=1&&b.minY>=0&&b.maxY<=1);
          // The world must not shrink with the camera, or high zoom traps the specimen in a sliver.
          assert.equal(b.minX,base.minX);assert.equal(b.maxX,base.maxX);
          assert.equal(b.minY,base.minY);assert.equal(b.maxY,base.maxY);
          // Non-degenerate on both axes: a sliver would reverse velocity every frame (180° head whip).
          assert.ok(b.maxX-b.minX>=.05,`x sliver at ${w}x${h} zoom ${zoom}`);
          assert.ok(b.maxY-b.minY>=.05,`y sliver at ${w}x${h} zoom ${zoom}`);
          for(const [x,y,vx,vy] of [[-2,-2,-.27,-.32],[2,2,.27,.32],[.5,.5,0,0]]){
            const fly={x,y,vx,vy};constrainToHabitat(fly,b);
            assert.ok(fly.x>=b.minX-1e-9&&fly.x<=b.maxX+1e-9);
            assert.ok(fly.y>=b.minY-1e-9&&fly.y<=b.maxY+1e-9);
            checked++;
          }
        }
      }
    }
  }
  assert.equal(checked,288);
});

test('at zoom 1 the body core stays inside the outer frame (wingtips may sweep the glass)',()=>{
  for(const [w,h] of [[280,540],[393,567],[1280,630],[1920,1080]]){
    const b=habitatBounds(w,h,1,{x:0,y:0});
    const radius=ROAM_RADIUS*b.magnification+12;
    for(const x of [b.minX,b.maxX])for(const y of [b.minY,b.maxY]){
      assert.ok(x*w-radius>=-1e-8&&x*w+radius<=w+1e-8);
      assert.ok(y*h-radius>=-1e-8&&y*h+radius<=h+1e-8);
    }
  }
});

test('outward velocity turns inward at each boundary',()=>{
  const b=habitatBounds(900,630,1,{x:0,y:0});
  const low={x:-1,y:-1,vx:-.27,vy:-.32};constrainToHabitat(low,b);
  assert.ok(low.vx>0&&low.vy>0);
  const high={x:2,y:2,vx:.27,vy:.32};constrainToHabitat(high,b);
  assert.ok(high.vx<0&&high.vy<0);
});

test('an already visible paused specimen does not move',()=>{
  const b=habitatBounds(900,630,1,{x:0,y:0});
  const f={x:.5,y:.5,vx:0,vy:0},before={...f};
  constrainToHabitat(f,b);assert.deepEqual(f,before);
});
