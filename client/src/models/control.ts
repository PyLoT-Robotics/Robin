export interface Control {
  LT: boolean
  RT: boolean
  LB: boolean
  RB: boolean
  A: boolean
  B: boolean
  X: boolean
  Y: boolean
  UP: boolean
  DOWN: boolean
  LEFT: boolean
  RIGHT: boolean
  leftStick: {
    x: number
    y: number
  }
  rightStick: {
    x: number
    y: number
  }
}
