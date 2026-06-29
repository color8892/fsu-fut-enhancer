export function installMiscItemPatch(deps) {
  const { call, events, fy, cntlr } = deps;

  UTMiscItemView.prototype.renderItem = function(t, e) {
      call.view.miscItem.call(this, t, e);
      if(t.isPlayerPickItem()){
          let pickOddo = events.getOddo(t.definitionId);
          if(pickOddo){
              if(this.className.includes("Small")){
                  if(cntlr.current().className.includes("Unassigned") && this.getRootElement().parentElement){
                      let oddoBox = events.createElementWithConfig("div", {
                          textContent:`${fy("returns.text")}${pickOddo.toLocaleString()}`,
                          classList: ['currency-coins']
                      });
                      this.getRootElement().parentElement.appendChild(oddoBox);
                  }
              }else{
                  let oddoBox = events.createElementWithConfig("div", {
                      style:{
                          position:"absolute",
                          bottom:"0",
                          backgroundColor:"rgb(0 0 0 / 60%)",
                          width:"100%",
                          textAlign:"center",
                          padding:".2rem 0",
                          color:"#ffffff",
                          fontSize:"1rem",
                          paddingBottom:".5rem"
                      }
                  });
                  let oddoTitle = events.createElementWithConfig("div", {
                      textContent:_.replace(_.replace(fy("returns.text"),":",""),"：","")
                  });
                  oddoBox.appendChild(oddoTitle)
                  let oddoCoin = events.createElementWithConfig("div", {
                      classList: ['currency-coins'],
                      textContent:pickOddo.toLocaleString()
                  });
                  oddoBox.appendChild(oddoCoin)
                  this.getRootElement().appendChild(oddoBox);
              }
          }
      }
  }
}
