// Vercel BotID client SDK — yalnız qeydiyyat (signup) POST-unu qoruyur.
// Görünməz CAPTCHA: real brauzer istifadəçisinə friksiya YOXDUR; yalnız
// bot/avtomatlaşdırılmış cəhdlər üçün token yoxlanılır. checkBotId() server
// tərəfdə fail-open işləyir (xəta → buraxılır).
import { initBotId } from "botid/client/core";

initBotId({
  protect: [
    { path: "/qeydiyyat", method: "POST" },
  ],
});
