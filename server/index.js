
/*
 * @author     Martin Høgh <mh@mapcentia.com>
 * @copyright  2013-2025 MapCentia ApS
 * @license    http://www.gnu.org/licenses/#AGPL  GNU AFFERO GENERAL PUBLIC LICENSE 3
 */

const express = require('express');
const router = express.Router();
const config = require('../../../config/config.js');
const FormData = require('form-data');
const fetch = require('node-fetch');

const createId = () => (+new Date * (Math.random() + 1)).toString(36).substr(2, 5);


router.post('/api/extension/fkgupload', async function (req, response) {
    const payload = req.body;

    const uploadUrl = config.gc2.host + "/controllers/upload/vector";
    const processUrl = config.gc2.host + "/extensions/fkgupload/api/process";

    try {
        // Extract and decode the base64 image from the file property
        if (!payload.file) {
            throw new Error('No file provided in payload');
        }

        // Split the data URL to get content type and base64 data
        const parts = payload.file.split(';');
        const contentType = parts[0].split(':')[1];
        const base64Data = parts[1].split(',')[1];

        // Decode base64 to buffer
        const fileBuffer = Buffer.from(base64Data, 'base64');

        // Determine file extension from content type
        const extension = contentType.split('/')[1] || 'png';
        const filename = createId() + '.' + extension;

        // Create FormData - the order and structure must match what PHP expects
        const formData = new FormData();

        // PHP expects these fields from $_REQUEST
        formData.append('name', filename);
        formData.append('type', contentType);
        formData.append('relativePath', 'null');

        // The file must be appended with proper options for PHP to recognize it
        formData.append('file', fileBuffer, {
            filename: filename,
            contentType: contentType,
            knownLength: fileBuffer.length
        });

        // Add session cookie if available
        const headers = {};
        if (req?.session?.gc2SessionId) {
            headers['Cookie'] = 'PHPSESSID=' + req.session.gc2SessionId;
        }

        // ===== DEBUG =====
        console.log('=== REQUEST DEBUG ===');
        console.log('URL:', uploadUrl);
        console.log('File:', filename);
        console.log('Size:', fileBuffer.length, 'bytes');
        console.log('Content-Type:', contentType);
        console.log('Session:', req?.session?.gc2SessionId ? 'Present' : 'Missing');
        console.log('====================');

        // Use node-fetch with FormData - it handles the stream properly
        let res = await fetch(uploadUrl, {
            method: 'POST',
            body: formData,
            headers: {
                ...headers,
                ...formData.getHeaders()
            }
        });

        console.log('Response status:', res.status);

        let responseText = await res.text();
        console.log('Response body:', responseText);

        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}, body: ${responseText}`);
        }

        // Try to parse as JSON
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            data = { success: true, message: responseText };
        }

        console.log('Success response:', data);

        // Upload successful, now process the file

        res = await fetch(processUrl, {
            method: 'POST',
            body: JSON.stringify({fileName: filename, delete: false}),
            headers
        });

        console.log('Response status:', res.status);

        responseText = await res.text();
        console.log('Response body:', responseText);

        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}, body: ${responseText}`);
        }

        // Try to parse as JSON
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            data = { success: true, message: responseText };
        }

        console.log('Success response:', data);
        // Process successful, return the result
        response.send(data);

    } catch (error) {
        console.error('Error details:', error);
        response.status(500).send({
            success: false,
            message: 'Failed to process upload',
            error: error.message
        });
    }
});

router.get('/api/extensions/fkgupload/api/process/:type/:id', async function (req, response) {
    const payload = req.body;
    const type = req.params.type;
    const id = req.params.id;
    const url = config.gc2.host + `/extensions/fkgupload/api/process/${type}/${id}`;

    console.log('Request URL:', url);

    const headers = {};
    if (req?.session?.gc2SessionId) {
        headers['Cookie'] = 'PHPSESSID=' + req.session.gc2SessionId;
    }

    const res = await fetch(url, {
        method: 'GET',
        headers
    });

    const responseText = await res.text();

    if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}, body: ${responseText}`);
    }

    // Try to parse as JSON
    try {
        data = JSON.parse(responseText);
    } catch (e) {
        data = { success: true, message: responseText };
    }
    // Process successful, return the result
    response.send(data);
})

router.post('/api/extensions/fkgupload/api/process/:type', async function (req, response) {
    const payload = req.body;
    const type = req.params.type;
    const url = config.gc2.host + `/extensions/fkgupload/api/process/${type}`;

    console.log('Request URL:', url);

    const headers = {};
    if (req?.session?.gc2SessionId) {
        headers['Cookie'] = 'PHPSESSID=' + req.session.gc2SessionId;
    }

    const res = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers
    });

    const responseText = await res.text();

    if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}, body: ${responseText}`);
    }

    // Try to parse as JSON
    try {
        data = JSON.parse(responseText);
    } catch (e) {
        data = { success: true, message: responseText };
    }
    // Process successful, return the result
    response.send(data);
})

router.put('/api/extensions/fkgupload/api/process/:type', async function (req, response) {
    const payload = req.body;
    const type = req.params.type;
    const url = config.gc2.host + `/extensions/fkgupload/api/process/${type}`;

    console.log('Request URL:', url);

    const headers = {};
    if (req?.session?.gc2SessionId) {
        headers['Cookie'] = 'PHPSESSID=' + req.session.gc2SessionId;
    }

    const res = await fetch(url, {
        method: 'PUT',
        body: JSON.stringify(payload),
        headers
    });

    const responseText = await res.text();

    if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}, body: ${responseText}`);
    }

    // Try to parse as JSON
    try {
        data = JSON.parse(responseText);
    } catch (e) {
        data = { success: true, message: responseText };
    }
    // Process successful, return the result
    response.send(data);
})

router.delete('/api/extensions/fkgupload/api/process/7900/:id', async function (req, response) {
    const id = req.params.id;
    const url = config.gc2.host + `/extensions/fkgupload/api/process/7900/${id}`;

    console.log('Request URL:', url);

    const headers = {};
    if (req?.session?.gc2SessionId) {
        headers['Cookie'] = 'PHPSESSID=' + req.session.gc2SessionId;
    }

    const res = await fetch(url, {
        method: 'DELETE',
        headers
    });

    const responseText = await res.text();

    if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}, body: ${responseText}`);
    }
    // Try to parse as JSON
    try {
        data = JSON.parse(responseText);
    } catch (e) {
        data = { success: true, message: responseText };
    }
    // Process successful, return the result
    response.send(data);
})
module.exports = router;
