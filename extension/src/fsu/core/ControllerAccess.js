export class ControllerAccess {
  current() {
    return _appMain?._rootViewController?.currentController?.currentController?.currentController;
  }

  right() {
    return _appMain?._rootViewController?.currentController?.currentController?.currentController?.rightController
      ?.currentController;
  }

  left() {
    return _appMain?._rootViewController?.currentController?.currentController?.currentController?.leftController;
  }
}