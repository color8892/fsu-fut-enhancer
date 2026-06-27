export function registerSettingsScreen({
  EAView,
  EAViewController,
  JSUtils,
  events,
  fy,
  cntlr,
  info,
  set,
  GM_openInTab,
  isPhone,
  enums
}) {
  const fsuSV = function () {
    EAView.call(this);
  };

  JSUtils.inherits(fsuSV, EAView);

  fsuSV.prototype._generate = function _generate() {
    if (!this._generated) {
      const wrapper = document.createElement("div");
      wrapper.classList.add("ut-club-search-filters-view");

      const container = document.createElement("div");
      container.classList.add("ut-pinned-list-container", "ut-content-container");

      this.__content = document.createElement("div");
      this.__content.classList.add("ut-content");

      const list = document.createElement("div");
      list.classList.add("ut-pinned-list");

      const styleSection = document.createElement("div");
      styleSection.classList.add("sort-filter-container");

      const styleTitle = document.createElement("h4");
      styleTitle.textContent = fy("set.style.title");
      styleSection.appendChild(styleTitle);

      const styleBox = document.createElement("div");
      styleBox.classList.add("fsu-setbox");

      this._cStyle = {};
      this._cStyle.new = events.createToggle(fy("set.style.new"), async (control) => {
        set.save("card_style", control.getToggleState() ? 2 : 1);
        cntlr.current().getView()._cStyle.old.toggle();
      });
      styleBox.appendChild(this._cStyle.new.getRootElement());

      this._cStyle.old = events.createToggle(fy("set.style.old"), async (control) => {
        set.save("card_style", control.getToggleState() ? 1 : 2);
        cntlr.current().getView()._cStyle.new.toggle();
      });
      styleBox.appendChild(this._cStyle.old.getRootElement());

      (info.set.card_style == 1 ? this._cStyle.old : this._cStyle.new).toggle(1);
      styleSection.appendChild(styleBox);
      list.appendChild(styleSection);

      for (const group in info.setfield) {
        const section = document.createElement("div");
        section.classList.add("sort-filter-container");

        const title = document.createElement("h4");
        title.textContent = fy(`set.${group}.title`);
        section.appendChild(title);

        const box = document.createElement("div");
        box.classList.add("fsu-setbox");
        this[`_${group}`] = {};

        for (const item of info.setfield[group]) {
          this[`_${group}`][item] = set.addToggle(group, item);
          box.appendChild(this[`_${group}`][item].getRootElement());
        }

        section.appendChild(box);
        list.appendChild(section);
      }

      this.__content.appendChild(list);

      const buttonContainer = document.createElement("div");
      buttonContainer.classList.add("button-container");
      const buttonText = fy("settingsbutton.phone").split("、");

      this._fsuinfo = events.createButton(
        new UTStandardButtonControl(),
        isPhone() ? buttonText[0] : fy("set.getdoc"),
        () => {
          GM_openInTab("https://mfrasi851i.feishu.cn/wiki/OLNswCYQciVKw8k9iaAcmOY1nmf", {
            active: true,
            insert: true,
            setParent: true
          });
        },
        "call-to-action"
      );
      buttonContainer.appendChild(this._fsuinfo.__root);

      this._fsuheadentrance = events.createButton(
        new UTStandardButtonControl(),
        isPhone() ? buttonText[1] : fy("headentrance.popupmt"),
        () => {
          events.popup(
            fy("headentrance.popupmt"),
            fy("headentrance.popupm"),
            (action, input) => {
              if (action === 2) {
                const value = Number(input.getValue());
                if (!_.isNaN(value) && value > 0 && value < 9) {
                  set.save("headentrance_number", value);
                } else if (value == 0) {
                  set.save("headentrance_number", isPhone() ? 3 : 5);
                } else {
                  events.notice(fy("notice.seterror"), 2);
                }
              }
            },
            [{ labelEnum: enums.UIDialogOptions.OK }, { labelEnum: enums.UIDialogOptions.CANCEL }],
            [fy("headentrance.placeholder"), info.set.headentrance_number],
            true
          );
        },
        "call-to-action"
      );
      buttonContainer.appendChild(this._fsuheadentrance.__root);

      this._fsuqueries = events.createButton(
        new UTStandardButtonControl(),
        isPhone() ? buttonText[2] : fy("numberofqueries.btntext"),
        () => {
          events.popup(
            fy("numberofqueries.btntext"),
            fy("numberofqueries.popupm"),
            (action, input) => {
              if (action === 2) {
                const value = input.getValue();
                if (!isNaN(value) && parseFloat(value) !== 0) {
                  set.save("queries_number", Number(value));
                } else if (value == "") {
                  set.save("queries_number", 5);
                } else {
                  events.notice(fy("notice.seterror"), 2);
                }
              }
            },
            false,
            [fy("numberofqueries.placeholder"), info.set.queries_number],
            true
          );
        },
        "call-to-action"
      );
      buttonContainer.appendChild(this._fsuqueries.__root);

      this.__content.appendChild(buttonContainer);
      container.appendChild(this.__content);
      wrapper.appendChild(container);
      this.__root = wrapper;
      this._generated = true;
    }
  };

  const fsuSC = function () {
    EAViewController.call(this);
  };

  JSUtils.inherits(fsuSC, EAViewController);

  fsuSC.prototype._getViewInstanceFromData = function () {
    return new fsuSV();
  };

  fsuSC.prototype.viewDidAppear = function () {
    this.getNavigationController().setNavigationVisibility(true, true);
  };

  fsuSC.prototype.getNavigationTitle = function () {
    return fy("set.title");
  };

  return { fsuSC, fsuSV };
}