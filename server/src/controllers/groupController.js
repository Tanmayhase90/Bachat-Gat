const pool = require('../config/db');
const { logActivity } = require('../utils/logger');

/**
 * GET /api/group
 * Get active group details with member count and aggregated stats
 */
async function getGroupDetails(req, res, next) {
  try {
    const groupId = req.user.groupId || 1;

    const [groups] = await pool.query(
      `SELECT g.*, u.name as created_by_name,
        (SELECT COUNT(*) FROM group_members WHERE group_id = g.id AND is_active = 1) as total_active_members,
        (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as total_members
       FROM \`groups\` g
       LEFT JOIN users u ON g.created_by = u.id
       WHERE g.id = ?`,
      [groupId]
    );

    if (groups.length === 0) {
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    res.json({ success: true, group: groups[0] });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/group
 * Update group configuration (Name, monthly contribution per share, monthly target, description)
 */
async function updateGroupDetails(req, res, next) {
  try {
    const groupId = req.user.groupId || 1;
    const { group_name, monthly_contribution_per_share, monthly_target, description } = req.body;

    await pool.query(
      `UPDATE \`groups\` 
       SET group_name = COALESCE(?, group_name),
           monthly_contribution_per_share = COALESCE(?, monthly_contribution_per_share),
           monthly_target = COALESCE(?, monthly_target),
           description = COALESCE(?, description)
       WHERE id = ?`,
      [
        group_name ? group_name.trim() : null,
        monthly_contribution_per_share !== undefined ? parseFloat(monthly_contribution_per_share) : null,
        monthly_target !== undefined ? parseFloat(monthly_target) : null,
        description !== undefined ? description.trim() : null,
        groupId,
      ]
    );

    await logActivity(
      groupId,
      req.user.id,
      'GROUP_UPDATED',
      `Group settings updated by ${req.user.name}`
    );

    const [updated] = await pool.query('SELECT * FROM `groups` WHERE id = ?', [groupId]);

    res.json({
      success: true,
      message: 'Group settings updated successfully',
      group: updated[0],
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getGroupDetails,
  updateGroupDetails,
};
