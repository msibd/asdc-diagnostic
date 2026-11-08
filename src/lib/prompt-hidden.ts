import { stdin, stdout } from "node:process";
import { emitKeypressEvents } from "node:readline";

type Keypress = {
  ctrl?: boolean;
  name?: string;
};

export function promptHidden(label: string): Promise<string> {
  if (!stdin.isTTY || !stdin.setRawMode) {
    throw new Error("Run this command in an interactive terminal to enter the password securely.");
  }

  emitKeypressEvents(stdin);

  return new Promise((resolve, reject) => {
    let value = "";
    let finished = false;

    const finish = (error?: Error) => {
      if (finished) return;
      finished = true;
      stdin.removeListener("keypress", onKeypress);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };

    const onKeypress = (character: string, key: Keypress) => {
      if (key.ctrl && key.name === "c") {
        finish(new Error("Password entry cancelled."));
      } else if (key.name === "return" || key.name === "enter") {
        finish();
      } else if (key.name === "backspace") {
        value = value.slice(0, -1);
      } else if (character && character >= " " && character !== "\u007f") {
        value += character;
      }
    };

    stdout.write(label);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("keypress", onKeypress);
  });
}
