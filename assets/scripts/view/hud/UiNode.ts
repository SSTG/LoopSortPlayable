import { Node, UITransform, Layers } from 'cc';

export function makeUiNode(name: string, parent: Node, w: number, h: number): Node {
  const n = new Node(name);
  n.layer = Layers.Enum.UI_2D;
  n.addComponent(UITransform).setContentSize(w, h);
  parent.addChild(n);
  return n;
}
