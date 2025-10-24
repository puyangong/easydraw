(function(){
  function History(){this.stack=[]}
  History.prototype.push=function(state){try{this.stack.push(JSON.stringify(state))}catch(e){}}
  History.prototype.undo=function(){if(this.stack.length<2)return null;this.stack.pop();try{return JSON.parse(this.stack[this.stack.length-1])}catch(e){return null}}
  History.prototype.current=function(){if(!this.stack.length)return null;try{return JSON.parse(this.stack[this.stack.length-1])}catch(e){return null}}
  History.prototype.clear=function(){this.stack=[]}
  window.AppHistory=new History()
})();
