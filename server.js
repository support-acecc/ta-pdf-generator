const express = require('express');
const PDFDocument = require('pdfkit');
const { google } = require('googleapis');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const stream = require('stream');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const PROJECT_ID = 'airtable-ta-pdf-generator';
const SECRET_NAME = 'ta-pdf-generator-key';
const FOLDER_ID = '1vyUQbW7z7BMJQBKIafeTwYdczd7PGMyu';

let googleAuth = null;

// ============================================================================
// INITIALIZATION - Load Service Account Key from Secret Manager
// ============================================================================

async function initializeAuth() {
  try {
    console.log('[INIT] Loading service account key from Secret Manager...');
    
    const secretClient = new SecretManagerServiceClient();
    const secretName = `projects/${PROJECT_ID}/secrets/${SECRET_NAME}/versions/latest`;
    
    const [version] = await secretClient.accessSecretVersion({ name: secretName });
    const secretString = version.payload.data.toString('utf8');
    const serviceAccount = JSON.parse(secretString);
    
    console.log('[INIT] Service account loaded');
    console.log('[INIT] Service account email:', serviceAccount.client_email);
    
    googleAuth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/drive']
    });
    
    console.log('[INIT] Google Auth initialized');
    return googleAuth;
  } catch (error) {
    console.error('[INIT] ERROR loading service account:', error.message);
    console.error('[INIT] Stack:', error.stack);
    throw error;
  }
}

// ============================================================================
// PDF GENERATION
// ============================================================================

function generatePDF(taData) {
  return new Promise((resolve, reject) => {
    try {
      console.log('[PDF] Generating PDF for:', taData.childcareProvider);
      
      const doc = new PDFDocument({ margin: 36, size: 'Letter' });
      
      // Title
      doc.fontSize(24).font('Helvetica-Bold').text('TECHNICAL ASSISTANCE AGREEMENT', { align: 'center' });
      doc.moveDown(0.5);
      
      // Confidentiality Section
      doc.fontSize(14).font('Helvetica-Bold').text('Confidentiality Statement');
      doc.fontSize(11).font('Helvetica').text(
        'Everything discussed and done in the technical assistance partnership is confidential. The Technical Assistance Partner can share any information that occurs during each session. The Technical Assistance Professional will share only agreed-upon information with the Technical Assistance Partner\'s supervisor.\n\nACECC is a non-profit and non-regulatory agency; however, all staff are mandated reporters and are required to report abuse or neglect of children or adults.',
        { align: 'justify' }
      );
      doc.moveDown(0.5);
      
      // Scheduling Section
      doc.fontSize(14).font('Helvetica-Bold').text('Scheduling');
      doc.fontSize(11).font('Helvetica').text(
        'The technical assistance process is most effective when participants stick to a regular routine. This routine should include setting goals, coaching conversations, and sharing feedback. Technical Assistance Partners have the opportunity to meet and talk individually with their Technical Assistance Professional to discuss each part of this routine. If rescheduling is needed, both parties will commit to communicate in the agreed manner.',
        { align: 'justify' }
      );
      doc.moveDown(0.5);
      
      // Roles and Responsibilities
      doc.fontSize(14).font('Helvetica-Bold').text('Roles and Responsibilities');
      
      doc.fontSize(12).font('Helvetica-Bold').text('Technical Assistance Professional Responsibilities:');
      doc.fontSize(11).font('Helvetica');
      const taProResponsibilities = [
        'Conversations that emphasize your strengths and tailor technical assistance to support individual preferences.',
        'Actively helping you find information and research, partnering with you to achieve your goals.',
        'Engage in reflective discussions about our shared goals, work plans, observations, and feedback.',
        'Regularly check the evidence to see if goals are being met.',
        'Open communication and confidentiality maintaining a non-judgmental and positive approach.',
        'Observe, listen, and learn from you to better understand your educational values and beliefs.',
        'Honor all commitments, including being punctual and prepared for all scheduled sessions.'
      ];
      taProResponsibilities.forEach(resp => {
        doc.text(`• ${resp}`, { align: 'left' });
      });
      doc.moveDown(0.3);
      
      doc.fontSize(12).font('Helvetica-Bold').text('Technical Assistance Supervisor Responsibilities:');
      doc.fontSize(11).font('Helvetica-Oblique').text('(if applicable)');
      doc.fontSize(11).font('Helvetica');
      const taSuperResponsibilities = [
        'Support the continued quality improvements within each classroom while maintaining licensing compliance.',
        'Support the relationship between the Technical Assistance Professional and teaching staff by allowing time outside of the classroom for reflective practices and honoring allocated technical assistance hours and scheduled meetings arranged with the Technical Assistance Professional.',
        'Communicate with your ACECC Technical Assistance Professional if external coaching/consulting services are used so allocated technical assistance hours can be adjusted if needed.'
      ];
      taSuperResponsibilities.forEach(resp => {
        doc.text(`• ${resp}`, { align: 'left' });
      });
      doc.moveDown(0.5);
      
      // Agreement Section
      doc.fontSize(14).font('Helvetica-Bold').text('Agreement and Signatures');
      doc.fontSize(11).font('Helvetica').text(
        'By signing below, the Technical Assistance Professional and Technical Assistance Partner acknowledge that they have reviewed this agreement and understand the expectations, responsibilities, confidentiality, scheduling, and communication structure described above.',
        { align: 'justify' }
      );
      doc.moveDown(0.5);
      
      // Organization
      doc.fontSize(12).font('Helvetica-Bold').text('Organization');
      doc.fontSize(11).font('Helvetica').text(taData.childcareProvider);
      doc.moveDown(0.3);
      
      // Technical Assistance Professional
      doc.fontSize(12).font('Helvetica-Bold').text('Technical Assistance Professional');
      doc.fontSize(11).font('Helvetica').text(taData.coach.display || 'N/A');
      doc.moveDown(0.3);
      
      // Technical Assistance Partner
      doc.fontSize(12).font('Helvetica-Bold').text('Technical Assistance Partner');
      doc.fontSize(11).font('Helvetica').text(taData.provider.display || 'N/A');
      doc.moveDown(0.3);
      
      // Technical Assistance Supervisor
      doc.fontSize(12).font('Helvetica-Bold').text('Technical Assistance Supervisor');
      doc.fontSize(11).font('Helvetica').text(taData.owner.display || 'N/A');
      doc.moveDown(0.5);
      
      // Signatures
      doc.fontSize(12).font('Helvetica-Bold').text('Signatures');
      
      if (taData.signatures.coach) {
        doc.fontSize(11).font('Helvetica').text('Technical Assistance Professional:');
        doc.image(taData.signatures.coach, { width: 150, height: 60 });
      } else {
        doc.fontSize(11).font('Helvetica').text('Technical Assistance Professional:');
        doc.moveTo(doc.x, doc.y).lineTo(doc.x + 200, doc.y).stroke();
      }
      doc.moveDown(0.3);
      
      if (taData.signatures.provider) {
        doc.fontSize(11).font('Helvetica').text('Technical Assistance Partner:');
        doc.image(taData.signatures.provider, { width: 150, height: 60 });
      } else {
        doc.fontSize(11).font('Helvetica').text('Technical Assistance Partner:');
        doc.moveTo(doc.x, doc.y).lineTo(doc.x + 200, doc.y).stroke();
      }
      doc.moveDown(0.3);
      
      if (taData.signatures.owner) {
        doc.fontSize(11).font('Helvetica').text('Technical Assistance Supervisor:');
        doc.image(taData.signatures.owner, { width: 150, height: 60 });
      } else {
        doc.fontSize(11).font('Helvetica').text('Technical Assistance Supervisor:');
        doc.moveTo(doc.x, doc.y).lineTo(doc.x + 200, doc.y).stroke();
      }
      doc.moveDown(0.5);
      
      // Date
      doc.fontSize(12).font('Helvetica-Bold').text('Date');
      doc.fontSize(11).font('Helvetica').text(taData.date || 'N/A');
      
      console.log('[PDF] PDF document created');
      
      // Convert to buffer
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        console.log('[PDF] PDF buffer created, size:', pdfBuffer.length, 'bytes');
        resolve(pdfBuffer);
      });
      doc.on('error', reject);
      
      doc.end();
      
    } catch (error) {
      console.error('[PDF] Error generating PDF:', error.message);
      reject(error);
    }
  });
}

// ============================================================================
// GOOGLE DRIVE UPLOAD
// ============================================================================

async function uploadToDrive(pdfBuffer, filename) {
  try {
    console.log('[DRIVE] Uploading PDF to Google Drive...');
    console.log('[DRIVE] Filename:', filename);
    console.log('[DRIVE] Folder ID:', FOLDER_ID);
    
    const drive = google.drive({ version: 'v3', auth: googleAuth });
    
    // Create a readable stream from the buffer
    const bufferStream = new stream.Readable();
    bufferStream.push(pdfBuffer);
    bufferStream.push(null);
    
    const fileMetadata = {
      name: filename,
      parents: [FOLDER_ID]
    };
    
    const media = {
      mimeType: 'application/pdf',
      body: bufferStream
    };
    
    console.log('[DRIVE] Creating file on Google Drive...');
    const file = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, webViewLink'
    });
    
    console.log('[DRIVE] File created with ID:', file.data.id);
    console.log('[DRIVE] Web view link:', file.data.webViewLink);
    
    // Make file publicly readable
    console.log('[DRIVE] Setting file permissions...');
    await drive.permissions.create({
      fileId: file.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });
    
    console.log('[DRIVE] File is now publicly accessible');
    
    return {
      fileId: file.data.id,
      webViewLink: file.data.webViewLink,
      downloadLink: `https://drive.google.com/uc?export=download&id=${file.data.id}`
    };
    
  } catch (error) {
    console.error('[DRIVE] Error uploading to Drive:', error.message);
    console.error('[DRIVE] Stack:', error.stack);
    throw error;
  }
}

// ============================================================================
// HTTP ENDPOINT
// ============================================================================

app.post('/generate-agreement', async (req, res) => {
  try {
    console.log('========== REQUEST RECEIVED ==========');
    console.log('[ENDPOINT] POST /generate-agreement');
    
    const taData = req.body;
    
    console.log('[ENDPOINT] Childcare Provider:', taData.childcareProvider);
    console.log('[ENDPOINT] Coach:', taData.coach?.display);
    console.log('[ENDPOINT] Provider:', taData.provider?.display);
    console.log('[ENDPOINT] Owner:', taData.owner?.display);
    
    // Generate PDF
    console.log('[ENDPOINT] Step 1: Generating PDF...');
    const pdfBuffer = await generatePDF(taData);
    
    // Upload to Drive
    console.log('[ENDPOINT] Step 2: Uploading to Google Drive...');
    const filename = `TA_Agreement_${taData.childcareProvider.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`;
    const driveResult = await uploadToDrive(pdfBuffer, filename);
    
    console.log('[ENDPOINT] Success! Returning links...');
    console.log('========== REQUEST COMPLETE ==========');
    
    res.status(200).json({
      success: true,
      message: 'PDF generated and uploaded successfully',
      fileId: driveResult.fileId,
      webViewLink: driveResult.webViewLink,
      downloadLink: driveResult.downloadLink
    });
    
  } catch (error) {
    console.error('[ENDPOINT] ERROR:', error.message);
    console.error('[ENDPOINT] Stack:', error.stack);
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// ============================================================================
// START SERVER
// ============================================================================

async function start() {
  try {
    console.log('[SERVER] Starting TA PDF Generator...');
    
    // Initialize auth
    await initializeAuth();
    
    // Start server
    app.listen(PORT, () => {
      console.log(`[SERVER] Service listening on port ${PORT}`);
    });
    
  } catch (error) {
    console.error('[SERVER] Failed to start:', error);
    process.exit(1);
  }
}

start();

module.exports = app;
