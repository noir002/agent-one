import User from "../models/User.js";

// "Leave a clean payment interface; I will choose the gateway later" (HLD,
// Phase 8). This is that seam: every place in the app that grants a plan
// or credits calls through here, never writes User.plan/credits directly —
// so swapping MockPaymentProvider for a real gateway's webhook handler
// later touches exactly one file. No gateway, no webhook, no card form:
// this is explicitly stubbed per the HLD ("no live payments yet").
//
// A real provider would implement the same two methods, called from a
// webhook after a real charge succeeds, instead of from an admin route.
class MockPaymentProvider {
  async grantPlan(userId, plan) {
    const user = await User.findByIdAndUpdate(userId, { plan }, { new: true });
    console.log(`[payments:mock] granted plan "${plan}" to user ${userId} — no real charge occurred`);
    return user;
  }

  async grantCredits(userId, amount) {
    const user = await User.findByIdAndUpdate(userId, { $inc: { credits: amount } }, { new: true });
    console.log(`[payments:mock] granted ${amount} credit(s) to user ${userId} — no real charge occurred`);
    return user;
  }
}

export const paymentProvider = new MockPaymentProvider();
