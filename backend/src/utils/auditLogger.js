import prisma from '../config/db.js';
import logger from '../config/logger.js';

export const logAudit = async ({ userId, action, module, details, ipAddress, userAgent, companyId }) => {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        module,
        details: details ? JSON.parse(JSON.stringify(details)) : null,
        ipAddress,
        userAgent,
        companyId,
      },
    });
  } catch (err) {
    logger.error('Failed to write Audit Log to DB: %o', err);
  }
};
