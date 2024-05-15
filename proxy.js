const express = require('express');
const bodyParser = require('body-parser');
const ytdl = require('ytdl-core');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_FILES = 3 // Ubah sesuai kebutuhan

// Middleware
app.use(bodyParser.json());

// Ensure the downloads directory exists
const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
}

// Serve static files from 'public' directory
app.use(express.static('public'));

// Serve the index.html file at the root URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Function to delete oldest files if the number exceeds MAX_FILES
const deleteOldestFiles = (dir) => {
    const files = fs.readdirSync(dir)
        .map(file => ({ file, time: fs.statSync(path.join(dir, file)).mtime.getTime() }))
        .sort((a, b) => a.time - b.time);

    while (files.length > MAX_FILES) {
        const oldestFile = files.shift();
        fs.unlinkSync(path.join(dir, oldestFile.file));
    }
};

app.post('/download', async (req, res) => {
    const { url } = req.body;

    if (!ytdl.validateURL(url)) {
        return res.status(400).json({ success: false, message: 'Invalid YouTube URL' });
    }

    try {
        const info = await ytdl.getInfo(url);
        const format = ytdl.chooseFormat(info.formats, { quality: 'highestvideo' });
        const filename = `${info.videoDetails.title.replace(/[<>:"/\\|?*]+/g, '')}.mp4`;
        const filepath = path.join(downloadsDir, filename);

        const writeStream = fs.createWriteStream(filepath);

        writeStream.on('finish', () => {
            deleteOldestFiles(downloadsDir);
            res.json({ success: true, downloadUrl: `/downloads/${filename}`, filename: filename });
        });

        writeStream.on('error', (error) => {
            console.error(error);
            res.status(500).json({ success: false, message: 'Error processing the video download' });
        });

        ytdl(url, { format: format }).pipe(writeStream);

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error processing the video download' });
    }
});

// Serve files from the 'downloads' directory
app.use('/downloads', express.static(downloadsDir));

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});