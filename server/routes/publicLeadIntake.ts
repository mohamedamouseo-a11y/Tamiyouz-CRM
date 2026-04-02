import { Router } from "express";
import { intakeLandingPageLead } from "../services/landingPageLeadIntakeService";

export function createPublicLeadIntakeRouter() {
  const router = Router();

  router.post("/lead-intake/:slug", async (req, res) => {
    try {
      const result = await intakeLandingPageLead(req.params.slug, req.body, {
        ipAddress: req.ip,
        userAgent: req.get("user-agent") || null,
        origin: req.get("origin") || req.get("referer") || null,
      });

      res.json(result);
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error?.message || "Failed to intake landing page lead",
      });
    }
  });

  return router;
}
