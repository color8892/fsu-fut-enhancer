function resolveSquadBuilderPrototype() {
  return typeof UTSquadBuilderViewController === "undefined"
    ? null
    : UTSquadBuilderViewController.prototype;
}

export function createSquadBuilderPatchDescriptors(deps) {
  const { call, events, fy, info, build } = deps;
  return [
    {
      id: "squad-builder.view-did-appear",
      resolveTarget: resolveSquadBuilderPrototype,
      verify: (target) =>
        typeof target?.viewDidAppear === "function" && typeof call.view?.build === "function",
      apply: (target) => {
        const original = target.viewDidAppear;
        target.viewDidAppear = function () {
          call.view.build.call(this);
          if (this.squad && this.squad.isSBC()) {
            this.getView().getSortDropDown().setIndexById(3);

            this.getView()._fsuleague = events.createToggle(
              `${fy("builder.league")}(${info.set.shield_league.length})`,
              async (event) => {
                build.set("league", event.getToggleState());
              }
            );
            this.getView()._fsuleague.toggle(info.build.league);
            this.getView()._searchOptions.__root.appendChild(this.getView()._fsuleague.__root);

            this.getView()._fsupos = events.createToggle(fy("builder.ignorepos"), async (event) => {
              build.set("ignorepos", event.getToggleState());
            });
            this.getView()._fsupos.toggle(info.build.ignorepos);
            this.getView()._searchOptions.__root.appendChild(this.getView()._fsupos.__root);
          }
        };
        return () => {
          target.viewDidAppear = original;
        };
      }
    }
  ];
}

export function installSquadBuilderPatches(deps, patchRegistry = null) {
  const descriptors = createSquadBuilderPatchDescriptors(deps);
  if (patchRegistry) return descriptors.map((descriptor) => patchRegistry.install(descriptor));

  return descriptors.map((descriptor) => {
    const target = descriptor.resolveTarget();
    if (!target) return { id: descriptor.id, status: "skipped", reason: "target-unavailable" };
    if (!descriptor.verify(target)) {
      return { id: descriptor.id, status: "skipped", reason: "verification-failed" };
    }
    descriptor.apply(target);
    return { id: descriptor.id, status: "installed" };
  });
}
