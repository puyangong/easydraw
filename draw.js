(function(){
  const canvas=document.getElementById('canvas');
  const ctx=canvas.getContext('2d');
  const DPR=window.devicePixelRatio||1;
  const MIN_SIZE=10;
  const topControls=document.getElementById('top-right-controls');
  const clearBtn=document.getElementById('clearBtn');
  const undoBtn=document.getElementById('undoBtn');
  const deleteBtn=document.getElementById('deleteBtn');
  const exportBtn=document.getElementById('exportBtn');
  const toolsBar=document.querySelector('.tools');
  const toolButtons=document.querySelectorAll('.tools [data-tool]');

  const fillColorInput=document.getElementById('fillColor');
  const presets=document.querySelectorAll('.preset');
  // 显示预设颜色背景
  presets.forEach(btn=>{const c=btn.getAttribute('data-color'); if(c) btn.style.backgroundColor=c;});
  const editOverlay=document.getElementById('edit-overlay');
  const btnMove=document.getElementById('btn-move');
  const btnDelete=document.getElementById('btn-delete');
  const btnResize=document.getElementById('btn-resize');
  const linePoints=document.getElementById('line-points');
  const lp1=document.getElementById('line-p1');
  const lpm=document.getElementById('line-pm');
  const lp2=document.getElementById('line-p2');
  const textModal=document.getElementById('text-modal');
  const textContent=document.getElementById('textContent');
  const textSize=document.getElementById('textSize');
  const textColor=document.getElementById('textColor');
  const textConfirm=document.getElementById('textConfirm');
  const textCancel=document.getElementById('textCancel');

  const state={
    shapes:[], tool:null, drawing:false, draft:null,
    selectedId:null, editing:false, moveMode:false, resizeMode:false,
    lineDragTarget:null,
    colors:{stroke:'#0000FF',fill:'#0000FF',text:'#333333'}
  };

  function resizeCanvas(){
    const w=window.innerWidth, h=window.innerHeight;
    canvas.style.width=w+'px';canvas.style.height=h+'px';
    canvas.width=Math.floor(w*DPR);canvas.height=Math.floor(h*DPR);
    ctx.setTransform(DPR,0,0,DPR,0,0);
    drawAll();
  }
  window.addEventListener('resize',resizeCanvas);
  resizeCanvas();

  function makeId(){return 'id'+Math.random().toString(36).slice(2)+Date.now()}
  function clear(){ctx.clearRect(0,0,canvas.width/DPR,canvas.height/DPR)}
  function drawRect(shape){ctx.lineWidth=2;ctx.strokeStyle=shape.stroke;ctx.fillStyle=shape.fill||'transparent';if(shape.type==='rect-fill'){ctx.fillRect(shape.x,shape.y,shape.w,shape.h)}else{ctx.strokeRect(shape.x,shape.y,shape.w,shape.h)}}
  function drawCircle(shape){ctx.lineWidth=2;ctx.strokeStyle=shape.stroke;ctx.fillStyle=shape.fill||'transparent';ctx.beginPath();ctx.arc(shape.cx,shape.cy,shape.r,0,Math.PI*2);shape.type==='circle-fill'?ctx.fill():ctx.stroke()}
  function drawLine(shape){ctx.lineWidth=2;ctx.strokeStyle=shape.stroke;ctx.beginPath();ctx.moveTo(shape.x1,shape.y1);ctx.lineTo(shape.x2,shape.y2);ctx.stroke();}
  function drawArrow(shape){drawLine(shape);const x1=shape.x1,y1=shape.y1,x2=shape.x2,y2=shape.y2;const ang=Math.atan2(y2-y1,x2-x1);const len=14, spread=7;const ax=x2-len*Math.cos(ang), ay=y2-len*Math.sin(ang);ctx.beginPath();ctx.moveTo(x2,y2);ctx.lineTo(ax+spread*Math.cos(ang+Math.PI/2), ay+spread*Math.sin(ang+Math.PI/2));ctx.moveTo(x2,y2);ctx.lineTo(ax-spread*Math.cos(ang+Math.PI/2), ay-spread*Math.sin(ang+Math.PI/2));ctx.stroke();}
  function drawText(shape){ctx.fillStyle=shape.color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${shape.size}px sans-serif`;const lines=shape.text.split(/\n/);const lh=shape.size*1.3;for(let i=0;i<lines.length;i++){ctx.fillText(lines[i],shape.x,shape.y+(i-(lines.length-1)/2)*lh)}}

  function drawAll(){clear();for(const shp of state.shapes){switch(shp.type){case 'rect-stroke':case 'rect-fill':drawRect(shp);break;case 'circle-stroke':case 'circle-fill':drawCircle(shp);break;case 'line':drawLine(shp);break;case 'arrow':drawArrow(shp);break;case 'text':drawText(shp);break;}}}

  function getBounds(shape){
    if(shape.type==='rect-stroke'||shape.type==='rect-fill')return {x1:shape.x,y1:shape.y,x2:shape.x+shape.w,y2:shape.y+shape.h};
    if(shape.type==='circle-stroke'||shape.type==='circle-fill')return {x1:shape.cx-shape.r,y1:shape.cy-shape.r,x2:shape.cx+shape.r,y2:shape.cy+shape.r};
    if(shape.type==='line'||shape.type==='arrow')return {x1:Math.min(shape.x1,shape.x2),y1:Math.min(shape.y1,shape.y2),x2:Math.max(shape.x1,shape.x2),y2:Math.max(shape.y1,shape.y2)};
    if(shape.type==='text'){ctx.font=`${shape.size}px sans-serif`;const lines=shape.text.split(/\n/);let w=0;for(const l of lines){w=Math.max(w,ctx.measureText(l).width)}const h=lines.length*shape.size*1.3;return {x1:shape.x-w/2,y1:shape.y-h/2,x2:shape.x+w/2,y2:shape.y+h/2};}
    return {x1:0,y1:0,x2:0,y2:0}
  }
  function pointInShape(x,y,shape){
    if(shape.type==='rect-stroke'||shape.type==='rect-fill'){return x>=shape.x&&y>=shape.y&&x<=shape.x+shape.w&&y<=shape.y+shape.h}
    if(shape.type==='circle-stroke'||shape.type==='circle-fill'){const dx=x-shape.cx,dy=y-shape.cy;return Math.hypot(dx,dy)<=shape.r}
    if(shape.type==='line'||shape.type==='arrow'){const d=distToSegment(x,y,shape.x1,shape.y1,shape.x2,shape.y2);return d<=6}
    if(shape.type==='text'){const b=getBounds(shape);return x>=b.x1&&y>=b.y1&&x<=b.x2&&y<=b.y2}
    return false
  }
  function distToSegment(px,py,x1,y1,x2,y2){const vx=x2-x1,vy=y2-y1;const wx=px-x1,wy=py-y1;const c1=vx*wx+vy*wy;if(c1<=0)return Math.hypot(px-x1,py-y1);const c2=vx*vx+vy*vy;if(c2<=c1)return Math.hypot(px-x2,py-y2);const b=c1/c2;const bx=x1+b*vx,by=y1+b*vy;return Math.hypot(px-bx,py-by)}

  function selectAt(x,y){for(let i=state.shapes.length-1;i>=0;i--){const shp=state.shapes[i];if(pointInShape(x,y,shp)){state.selectedId=shp.id;state.editing=true;deleteBtn.disabled=false;placeEditors(shp);return true}}return false}
  function placeEditors(shape){hideEditors();const b=getBounds(shape);if(shape.type==='line'||shape.type==='arrow'){linePoints.style.left='0px';linePoints.style.top='0px';const p1=getPagePos(shape.x1,shape.y1),p2=getPagePos(shape.x2,shape.y2);lp1.style.left=p1.x-9+'px';lp1.style.top=p1.y-9+'px';lp2.style.left=p2.x-9+'px';lp2.style.top=p2.y-9+'px';lpm.classList.add('hidden');linePoints.classList.remove('hidden');}
    else{const tl=getPagePos(b.x1,b.y1);
      editOverlay.style.left=tl.x+'px';
      editOverlay.style.top=tl.y+'px';
      editOverlay.style.width=Math.max(30,b.x2-b.x1)+'px';
      editOverlay.style.height=Math.max(30,b.y2-b.y1)+'px';
      editOverlay.classList.remove('hidden');}}
  function getPagePos(x,y){return {x:x,y:y}}
  function hideEditors(){editOverlay.classList.add('hidden');linePoints.classList.add('hidden')}
  function exitEdit(){state.selectedId=null;state.editing=false;state.moveMode=false;state.resizeMode=false;state.lineDragTarget=null;hideEditors();deleteBtn.disabled=true}

  function pushHistory(){AppHistory.push(state.shapes)}
  pushHistory();

  // 工具高亮效果
  function setActiveTool(tool){toolButtons.forEach(btn=>btn.classList.toggle('active',btn.getAttribute('data-tool')===tool))}
  function clearActiveTool(){toolButtons.forEach(btn=>btn.classList.remove('active'))}

  toolsBar.addEventListener('click',e=>{const t=e.target.closest('button');if(!t)return;const tool=t.getAttribute('data-tool');if(tool==='text'){openTextModal();setActiveTool('text');}else{state.tool=tool;exitEdit();setActiveTool(tool);}});
  presets.forEach(btn=>btn.addEventListener('click',()=>{const c=btn.getAttribute('data-color');fillColorInput.value=c;state.colors.stroke=c;state.colors.fill=c;state.colors.text=c;}));

  fillColorInput.addEventListener('input',e=>{state.colors.fill=e.target.value;state.colors.stroke=e.target.value});

  if(clearBtn){
    // 清屏功能 - 使用 pointerdown 统一支持鼠标和触摸事件
    const handleClear=(e)=>{
      e.preventDefault();
      e.stopPropagation();
      state.shapes=[];
      pushHistory();
      exitEdit();
      drawAll();
    };
    // 只使用 pointerdown，因为它在移动端和桌面端都能正常工作，且不会与 click 重复触发
    clearBtn.addEventListener('pointerdown',handleClear);
    // 防止触摸时触发其他事件
    clearBtn.addEventListener('touchstart',(e)=>{
      e.preventDefault();
      e.stopPropagation();
    });
  }
  undoBtn.addEventListener('click',()=>{const snap=AppHistory.undo();if(snap){state.shapes=snap;exitEdit();drawAll()}});
  exportBtn.addEventListener('click',()=>{
    const expCanvas=document.createElement('canvas');
    expCanvas.width=canvas.width;
    expCanvas.height=canvas.height;
    const expCtx=expCanvas.getContext('2d');
    // 先填充白色背景
    expCtx.fillStyle='#ffffff';
    expCtx.fillRect(0,0,expCanvas.width,expCanvas.height);
    // 将当前画布内容绘制到白色底上
    expCtx.drawImage(canvas,0,0);
    const url=expCanvas.toDataURL('image/png');
    const a=document.createElement('a');
    a.href=url;
    a.download='导出图片.png';
    a.click();
  });
  deleteBtn.addEventListener('click',()=>{if(!state.selectedId)return;state.shapes=state.shapes.filter(s=>s.id!==state.selectedId);pushHistory();exitEdit();drawAll()});

  btnMove.addEventListener('pointerdown',(e)=>{e.preventDefault();try{btnMove.setPointerCapture(e.pointerId)}catch(_){/* noop */}state.moveMode=true;state.resizeMode=false;const rect=canvas.getBoundingClientRect();const x=e.clientX-rect.left,y=e.clientY-rect.top;startX=x;startY=y;lastX=x;lastY=y;window.addEventListener('pointermove',onMoveDragMove);window.addEventListener('pointerup',onMoveDragUp)});
  function onMoveDragMove(e){const rect=canvas.getBoundingClientRect();const x=e.clientX-rect.left,y=e.clientY-rect.top;const shp=currentShape();if(!shp)return;const dx=x-lastX,dy=y-lastY;applyMove(shp,dx,dy);drawAll();placeEditors(shp);lastX=x;lastY=y}
  function onMoveDragUp(e){window.removeEventListener('pointermove',onMoveDragMove);window.removeEventListener('pointerup',onMoveDragUp);const shp=currentShape();if(shp)pushHistory();state.moveMode=false}
  btnResize.addEventListener('pointerdown',(e)=>{e.preventDefault();state.resizeMode=true;state.moveMode=false;const rect=canvas.getBoundingClientRect();const x=e.clientX-rect.left,y=e.clientY-rect.top;startX=x;startY=y;lastX=x;lastY=y;window.addEventListener('pointermove',onResizeDragMove);window.addEventListener('pointerup',onResizeDragUp)});
  function onResizeDragMove(e){const rect=canvas.getBoundingClientRect();const x=e.clientX-rect.left,y=e.clientY-rect.top;const shp=currentShape();if(!shp)return;applyResize(shp,x,y);drawAll();placeEditors(shp);lastX=x;lastY=y}
  function onResizeDragUp(e){window.removeEventListener('pointermove',onResizeDragMove);window.removeEventListener('pointerup',onResizeDragUp);const shp=currentShape();if(shp)pushHistory();state.resizeMode=false}
  btnDelete.addEventListener('click',()=>{if(!state.selectedId)return;state.shapes=state.shapes.filter(s=>s.id!==state.selectedId);pushHistory();exitEdit();drawAll()});
  // 端点直接拖动（去除中心点）
  let overlayDragActive=false;
  function startPointDrag(target,e){e.preventDefault();const rect=canvas.getBoundingClientRect();const x=e.clientX-rect.left,y=e.clientY-rect.top;const shp=currentShape();if(!shp||!(shp.type==='line'||shp.type==='arrow'))return;state.lineDragTarget=target;state.moveMode=false;state.resizeMode=false;startX=x;startY=y;lastX=x;lastY=y;overlayDragActive=true;window.addEventListener('pointermove',onPointDragMove);window.addEventListener('pointerup',onPointDragUp)}
  function onPointDragMove(e){if(!overlayDragActive)return;const rect=canvas.getBoundingClientRect();const x=e.clientX-rect.left,y=e.clientY-rect.top;const shp=currentShape();if(!shp)return;applyLineDrag(shp,x,y);drawAll();placeEditors(shp);lastX=x;lastY=y}
  function onPointDragUp(e){if(!overlayDragActive)return;overlayDragActive=false;window.removeEventListener('pointermove',onPointDragMove);window.removeEventListener('pointerup',onPointDragUp);const shp=currentShape();if(shp)pushHistory();state.lineDragTarget=null}
  lp1.addEventListener('pointerdown',e=>startPointDrag('p1',e));
  lp2.addEventListener('pointerdown',e=>startPointDrag('p2',e));

  function openTextModal(){textModal.classList.remove('hidden');textContent.value='';textSize.value=24;textColor.value=state.colors.text}
  textConfirm.addEventListener('click',()=>{textModal.classList.add('hidden');const txt=textContent.value.trim();if(!txt)return;const size=parseInt(textSize.value||24,10);const color=textColor.value;const cx=canvas.width/DPR/2,cy=canvas.height/DPR/2;const shape={id:makeId(),type:'text',x:cx,y:cy,text:txt,size:size,color:color};state.shapes.push(shape);pushHistory();drawAll()});
  textCancel.addEventListener('click',()=>{textModal.classList.add('hidden')});

  let startX=0,startY=0;let lastX=0,lastY=0;
  canvas.addEventListener('pointerdown',e=>{
    // 如果点击的不是 canvas 本身，不处理
    if(e.target!==canvas)return;
    if(canvas.setPointerCapture) try{canvas.setPointerCapture(e.pointerId)}catch(_){}
    const rect=canvas.getBoundingClientRect();
    const x=e.clientX-rect.left,y=e.clientY-rect.top;
    startX=x;startY=y;lastX=x;lastY=y;

    // 优先尝试选择已有图形（符合“点击选中目标后不再绘制”的要求）
    const hit=selectAt(x,y);
    if(hit && state.editing){
      const shp=currentShape();
      if(!shp) return;
      // 直线/箭头三点拖拽命中
      if(shp.type==='line'||shp.type==='arrow'){
        const d1=Math.hypot(x-shp.x1,y-shp.y1),
              d2=Math.hypot(x-shp.x2,y-shp.y2);
        const min=Math.min(d1,d2);
        if(min<=15){
          state.lineDragTarget=min===d1?'p1':'p2';
          return;
        }
      }
      // 默认进入移动模式（除非用户点了缩放）
      if(!state.resizeMode){
        state.moveMode=true;
      }
      return;
    }

    // 未命中任何图形：若有绘图工具则开始绘制，否则退出编辑
    if(state.tool){
      state.drawing=true;
      state.draft=makeDraft(state.tool,x,y);
      exitEdit();
      return;
    }else{
      exitEdit();
    }
  });

  canvas.addEventListener('pointermove',e=>{
    const rect=canvas.getBoundingClientRect();const x=e.clientX-rect.left,y=e.clientY-rect.top;const isMouseDown = e.pointerType==='mouse' ? (e.buttons===1) : true;
    if(state.drawing&&state.draft){updateDraft(state.draft,x,y);drawAll();drawDraft(state.draft)}
    else if(state.editing){const shp=currentShape();if(!shp){lastX=x;lastY=y;return} if(!isMouseDown){lastX=x;lastY=y;return}
      if(state.moveMode){const dx=x-lastX,dy=y-lastY;applyMove(shp,dx,dy);drawAll();placeEditors(shp)}
      else if(state.resizeMode){applyResize(shp,x,y);drawAll();placeEditors(shp)}
      else if(state.lineDragTarget){applyLineDrag(shp,x,y);drawAll();placeEditors(shp)}
    }
    lastX=x;lastY=y;
  });

  canvas.addEventListener('pointerup',e=>{
    if(canvas.releasePointerCapture) try{canvas.releasePointerCapture(e.pointerId)}catch(_){}
    const rect=canvas.getBoundingClientRect();const x=e.clientX-rect.left,y=e.clientY-rect.top;
    if(state.drawing&&state.draft){if(!isDraftBigEnough(state.draft)){state.draft=null;state.drawing=false;drawAll();return}
      state.shapes.push(commitDraft(state.draft));state.draft=null;state.drawing=false;pushHistory();drawAll();return}
    if(state.editing){const shp=currentShape();if(!shp)return; if(state.moveMode||state.resizeMode||state.lineDragTarget){pushHistory();state.moveMode=false;state.resizeMode=false;state.lineDragTarget=null}}
  });

  canvas.addEventListener('pointercancel',e=>{
    state.drawing=false;
    if(state.editing){state.moveMode=false;state.resizeMode=false;state.lineDragTarget=null}
  });

  function currentShape(){return state.shapes.find(s=>s.id===state.selectedId)||null}
  function makeDraft(tool,x,y){
    if(tool==='rect-stroke'||tool==='rect-fill')return {tool, x:x,y:y,w:0,h:0, stroke:state.colors.stroke, fill: tool==='rect-fill'?state.colors.fill:null};
    if(tool==='circle-stroke'||tool==='circle-fill')return {tool, cx:x,cy:y,r:0, stroke:state.colors.stroke, fill: tool==='circle-fill'?state.colors.fill:null};
    if(tool==='line'||tool==='arrow')return {tool,x1:x,y1:y,x2:x,y2:y, stroke:state.colors.stroke};
    return null
  }
  function updateDraft(d,x,y){
    if(!d)return; if(d.tool==='rect-stroke'||d.tool==='rect-fill'){d.w=x-d.x;d.h=y-d.y}
    else if(d.tool==='circle-stroke'||d.tool==='circle-fill'){d.r=Math.hypot(x-d.cx,y-d.cy)}
    else if(d.tool==='line'||d.tool==='arrow'){d.x2=x;d.y2=y}
  }
  function drawDraft(d){if(!d)return;ctx.save();ctx.setLineDash([6,6]);
    if(d.tool==='rect-stroke'||d.tool==='rect-fill'){ctx.strokeStyle=d.stroke;ctx.strokeRect(d.x,d.y,d.w,d.h)}
    else if(d.tool==='circle-stroke'||d.tool==='circle-fill'){ctx.strokeStyle=d.stroke;ctx.beginPath();ctx.arc(d.cx,d.cy,d.r,0,Math.PI*2);ctx.stroke()}
    else if(d.tool==='line'||d.tool==='arrow'){ctx.strokeStyle=d.stroke;ctx.beginPath();ctx.moveTo(d.x1,d.y1);ctx.lineTo(d.x2,d.y2);ctx.stroke()}
    ctx.restore()
  }
  function isDraftBigEnough(d){if(!d)return false; if(d.tool==='rect-stroke'||d.tool==='rect-fill'){return Math.abs(d.w)>=MIN_SIZE&&Math.abs(d.h)>=MIN_SIZE}
    if(d.tool==='circle-stroke'||d.tool==='circle-fill'){return d.r>=MIN_SIZE}
    if(d.tool==='line'||d.tool==='arrow'){return Math.hypot(d.x2-d.x1,d.y2-d.y1)>=MIN_SIZE}
    return false
  }
  function commitDraft(d){
    if(d.tool==='rect-stroke'||d.tool==='rect-fill'){return {id:makeId(),type:d.tool, x:Math.min(d.x,d.x+d.w), y:Math.min(d.y,d.y+d.h), w:Math.abs(d.w), h:Math.abs(d.h), stroke:d.stroke, fill:d.fill}}
    if(d.tool==='circle-stroke'||d.tool==='circle-fill'){return {id:makeId(),type:d.tool, cx:d.cx, cy:d.cy, r:d.r, stroke:d.stroke, fill:d.fill}}
    if(d.tool==='line'||d.tool==='arrow'){return {id:makeId(),type:d.tool, x1:d.x1,y1:d.y1,x2:d.x2,y2:d.y2, stroke:d.stroke}}
    return null
  }
  function applyMove(shp,dx,dy){
    if(shp.type==='rect-stroke'||shp.type==='rect-fill'){shp.x+=dx;shp.y+=dy}
    else if(shp.type==='circle-stroke'||shp.type==='circle-fill'){shp.cx+=dx;shp.cy+=dy}
    else if(shp.type==='line'||shp.type==='arrow'){shp.x1+=dx;shp.y1+=dy;shp.x2+=dx;shp.y2+=dy}
    else if(shp.type==='text'){shp.x+=dx;shp.y+=dy}
  }
  function applyResize(shp,x,y){
    const b=getBounds(shp);
    if(shp.type==='rect-stroke'||shp.type==='rect-fill'){shp.w=x-b.x1;shp.h=y-b.y1}
    else if(shp.type==='circle-stroke'||shp.type==='circle-fill'){const r=Math.hypot(x-shp.cx,y-shp.cy);shp.r=Math.max(r,2)}
    else if(shp.type==='text'){const delta=(x-lastX);shp.size=Math.max(12,Math.min(200,shp.size+delta*0.2))}
  }
  function applyLineDrag(shp,x,y){if(state.lineDragTarget==='p1'){shp.x1=x;shp.y1=y}else if(state.lineDragTarget==='p2'){shp.x2=x;shp.y2=y}}


})();
