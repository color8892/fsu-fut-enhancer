export function installSquadBuilderPatches(deps) {
  const { call, events, fy, info, build } = deps;

  UTSquadBuilderViewController.prototype.viewDidAppear = function () {
    call.view.build.call(this);
    if (this.squad && this.squad.isSBC()) {
      this.getView().getSortDropDown().setIndexById(3);

      this.getView()._fsuleague = events.createToggle(
        `${fy(`builder.league`)}(${info.set.shield_league.length})`,
        async (e) => {
          build.set("league", e.getToggleState());
        }
      );
      this.getView()._fsuleague.toggle(info.build.league);
      this.getView()._searchOptions.__root.appendChild(this.getView()._fsuleague.__root);

      this.getView()._fsupos = events.createToggle(fy(`builder.ignorepos`), async (e) => {
        build.set("ignorepos", e.getToggleState());
      });
      this.getView()._fsupos.toggle(info.build.ignorepos);
      this.getView()._searchOptions.__root.appendChild(this.getView()._fsupos.__root);
    }
  };
}