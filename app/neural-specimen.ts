/** Fixed topology; only pose and light change per frame. No biological fidelity implied. */
export type Neuron = { x:number; y:number; z:number; size:number; delay:number };
export type NeuralMesh = { nodes:Neuron[]; edges:{a:number;b:number;strength:number}[] };
const seed=(initial:number)=>{
  let value=initial;
  return ()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};
};

function connect(nodes:Neuron[],reach:number,neighbors=3):NeuralMesh {
  const edges:NeuralMesh['edges']=[],seen=new Set<string>();
  nodes.forEach((a,i)=>{
    const nearest=nodes.map((b,j)=>({j,d:Math.hypot(a.x-b.x,a.y-b.y,(a.z-b.z)*.7)}))
      .filter(p=>p.j!==i&&p.d<reach).sort((a,b)=>a.d-b.d).slice(0,neighbors);
    for(const {j,d} of nearest){
      const key=Math.min(i,j)+':'+Math.max(i,j);
      if(!seen.has(key)){seen.add(key);edges.push({a:i,b:j,strength:.4+.6*(1-d/reach)});}
    }
  });
  return {nodes,edges};
}

function volume(count:number,cy:number,length:number,width:number,depth:number,initial:number){
  const random=seed(initial),nodes:Neuron[]=[];
  // Nonuniform sampling avoids horizontal rows and repeating lattice patterns.
  while(nodes.length<count){
    const y=random()*2-1,x=random()*2-1,z=random()*2-1;
    if(x*x+y*y+z*z>1)continue;
    const taper=cy>0?1-y*.24:1;
    const point={x:x*width*taper,y:cy+y*length,z:z*depth,size:.16+random()*.21,delay:random()*.7};
    if(nodes.some(p=>Math.hypot(p.x-point.x,p.y-point.y,p.z-point.z)<.8))continue;
    nodes.push(point);
  }
  return nodes;
}
const tissue=[
  ...volume(125,-2.4,9.8,8.73,5.31,23),
  ...volume(125,15.4,11.5,7.56,4.32,97),
  ...volume(45,-17.1,4.2,6.8,3.4,331),
];
export const anatomy=connect(tissue,5.2,3);

function wing(initial:number):NeuralMesh {
  const random=seed(initial),nodes:Neuron[]=[];
  // Broad, translucent fly wings, fanning from a narrow hinge like the reference.
  const shape=(t:number,q:number)=>{
    const width=8.8*Math.sin(Math.PI*t)**.75;
    return {x:2+42*t,y:2+15*t+width*q,z:1.8*Math.sin(t*Math.PI)-q*q};
  };
  // Sparse branching veins define the fly-wing anatomy without a solid outline.
  const veinIndices:number[][]=[];
  for(let vein=0;vein<4;vein++){
    const ids:number[]=[];
    for(let i=0;i<13;i++){
      const t=.025+i/12*.955,q=(vein/3*2-1)*.87;
      ids.push(nodes.length);nodes.push({...shape(t,q),size:.19+random()*.14,delay:t*.7});
    }
    veinIndices.push(ids);
  }
  for(let i=0;i<95;i++){
    const t=.03+random()*.94,q=(random()*2-1)*.94,p=shape(t,q);
    if(nodes.some(n=>Math.hypot(n.x-p.x,n.y-p.y)<1)){i--;continue;}
    nodes.push({...p,size:.12+random()*.18,delay:random()*.9});
  }
  const mesh=connect(nodes,7,3);
  for(const indices of veinIndices)for(let i=1;i<indices.length;i++){
    mesh.edges.push({a:indices[i-1],b:indices[i],strength:.7});
  }
  return mesh;
}
export const leftWing=wing(89),rightWing=wing(137);
export const cognition=connect(volume(35,-18,3.7,4.8,3,841),4,3);
