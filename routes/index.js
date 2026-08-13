// /routes/index.js
// Point d'entrée des routes de l'application.
const express = require('express');
const path = require('path');
const router = express.Router();
const adminController = require('../controllers/adminController');
const settingsController = require('../controllers/settingsController');
const { validateBody } = require('../middleware/security');

router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'original', 'index.html'));
});

router.get('/admin/login', adminController.renderLogin);
router.post('/admin/login', adminController.loginLimiter, adminController.loginAdmin);
router.get('/admin/logout', adminController.ensureAdminSession, adminController.logoutAdmin);
router.get('/admin/dashboard', adminController.ensureAdminSession, adminController.renderDashboard);
router.get('/admin/search', adminController.ensureAdminSession, adminController.searchVisitors);
router.get('/admin/settings', adminController.ensureAdminSession, settingsController.renderSettings);
router.post('/admin/settings', adminController.ensureAdminSession, settingsController.updateSettings);

// Debug route: quick check to confirm route reachability without auth
router.get('/_debug_settings', (req, res) => {
  res.status(200).send('debug_settings_ok');
});
router.post('/admin/visitor/:id/delete', adminController.ensureAdminSession, adminController.deleteVisitorHandler);
router.post('/admin/visitor/:id/update', adminController.ensureAdminSession, adminController.updateVisitorHandler);

router.get('/admin/export/excel', adminController.ensureAdminSession, async (req, res) => {
  try {
    const visitors = await require('../models/visitorModel').findVisitors({ sort: 'DESC' });
    const header = 'Nom,E-mail,Téléphone,Pays,Date,IP\n';
    const rows = visitors.map((v) => `${v.full_name},${v.email},${v.phone},${v.country},${v.visited_at},${v.ip_address}`).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=visitors.csv');
    res.send(header + rows);
  } catch (error) {
    res.status(500).send('Impossible d’exporter les visiteurs.');
  }
});

router.get('/admin/export/pdf', adminController.ensureAdminSession, async (req, res) => {
  try {
    const visitors = await require('../models/visitorModel').findVisitors({ sort: 'DESC' });
    const content = visitors.map((v) => `${v.full_name} | ${v.email} | ${v.phone} | ${v.country} | ${v.visited_at}`).join('\n');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=visitors.pdf');
    res.send(`%PDF-1.4\n1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n4 0 obj<< /Length 44 >>stream\nBT /F1 12 Tf 72 720 Td (${content.replace(/\n/g, ' ')} ) Tj ET\nendstream\nendobj\n5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\nxref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000062 00000 n \n0000000119 00000 n \n0000000206 00000 n \n0000000304 00000 n \ntrailer<< /Size 6 /Root 1 0 R >>\nstartxref\n0\n%%EOF`);
  } catch (error) {
    res.status(500).send('Impossible d’exporter les visiteurs.');
  }
});

module.exports = router;
