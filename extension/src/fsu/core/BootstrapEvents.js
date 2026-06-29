/**
 * Early UI helpers attached to the shared `events` facade during futweb bootstrap.
 */

export function attachBootstrapEvents(events, { info, cntlr, isPhone, fy }) {
  events.countPlayerAccele = (h, ag, ac, st) => {
    let type = 4;
    const diff = Math.abs(ag - st);
    if (diff >= 20) {
      if (ag >= 80 && ac >= 80 && h <= 175) {
        type = 1;
      } else if (st >= 80 && ac >= 55 && h >= 188) {
        type = 7;
      }
    } else if (diff >= 12) {
      if (ag >= 70 && ac >= 80 && h <= 182) {
        type = 2;
      } else if (st >= 75 && ac >= 55 && h >= 183) {
        type = 6;
      }
    } else if (diff >= 4) {
      if (ag >= 65 && ac >= 70 && h <= 182) {
        type = 3;
      } else if (st >= 65 && ac >= 40 && h >= 181) {
        type = 5;
      }
    }
    return type;
  };

  events.taskHtml = function taskHtml(number, text) {
    let html = "<div>{Number}</div><div>{reward}</div>";
    if (number > 0) {
      html = html.replace("{Number}", fy("task.added") + number);
    } else {
      html = html.replace("fsu-task", "fsu-task no");
      html = html.replace("{Number}", fy("task.noadded"));
    }
    if (text == "、") {
      text = "";
    }
    let reward = text;
    reward = reward.replace("组合包", fy("task.pack"));
    reward = reward.replace("球员", fy("task.player"));
    html = html.replace("{reward}", reward);
    return html;
  };

  events.showLoader = () => {
    document.querySelector(".ut-click-shield").classList.add("showing", "fsu-loading");
    document.querySelector(".loaderIcon").style.display = "block";
  };

  events.hideLoader = () => {
    document.querySelector(".ut-click-shield").classList.remove("showing", "fsu-loading");
    document.querySelector(".loaderIcon").style.display = "none";
    if (info.run.template) {
      info.run.template = false;
      if (isPhone()) {
        if (cntlr.current() instanceof UTSBCSquadOverviewViewController) {
          cntlr.current()._fsu.fillSquadBtn.setInteractionState(1);
        } else if (cntlr.current() instanceof UTSBCSquadDetailPanelViewController) {
          _.forEach(cntlr.current().getNavigationController().childViewControllers, (c) => {
            if (c instanceof UTSBCSquadOverviewViewController) {
              c._fsu.fillSquadBtn.setInteractionState(1);
            }
          });
        }
      } else {
        cntlr.left()._fsu.fillSquadBtn.setInteractionState(1);
      }
    }
    if (info.run.losauction) {
      info.run.losauction = false;
      if (isPhone()) {
        events.notice("notice.phoneloas", 0);
      }
    }
    if (info.run.bulkbuy) {
      info.run.bulkbuy = false;
    }
    if (info.run.openPacks) {
      info.run.openPacks = false;
    }
    if (typeof events.changeLoadingText === "function") {
      events.changeLoadingText("loadingclose.text");
    }
  };
}