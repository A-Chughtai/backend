const cors = require('cors');
const express = require('express');
const fs = require("fs").promises; // Use promises-based fs
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());
app.use(cors({
    origin: "*",  // Allow all origins (or specify the exact one)
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"]
}));


const blogDataDir = path.join(__dirname, "blogData");
const blogFilePath = path.join(__dirname, "blogs.txt");
const idFilePath = path.join(__dirname, "id.txt");

// Ensure blogData directory exists
async function ensureDirectoryExists(dir) {
    try {
        await fs.access(dir);
    } catch {
        await fs.mkdir(dir);
    }
}

// Ensure id.txt exists
async function ensureIdFileExists() {
    try {
        await fs.access(idFilePath);
    } catch {
        await fs.writeFile(idFilePath, "1", "utf-8"); // Start ID at 1
    }
}

// Fetch all blogs
app.get("/get-blogs", async (req, res) => {
    try {
        await ensureDirectoryExists(blogDataDir);
        const files = await fs.readdir(blogDataDir);
        if (files.length === 0) return res.status(200).json([]);

        const blogs = await Promise.all(
            files.map(async (file) => {
                const filePath = path.join(blogDataDir, file);
                const content = await fs.readFile(filePath, "utf-8");
                
                // Split content by lines
                const lines = content.split('\n');
                const title = lines[1] || 'Untitled'; // Use the second line as the title
                const blogContent = lines.slice(2).join('\n'); // Exclude the first and second lines from content

                return {
                    id: path.basename(file, ".txt"),
                    title, // Title from the second line
                    content: blogContent, // Content excluding the first line
                };
            })
        );

        res.status(200).json(blogs);
    } catch (err) {
        console.error("Error fetching blogs:", err);
        res.status(500).json({ message: "Failed to load blogs." });
    }
});


// Save blogs from blogs.txt to individual files and clear blogs.txt
async function saveBlogsToFiles() {
    try {
        await ensureDirectoryExists(blogDataDir);
        await ensureIdFileExists();

        let currentId = parseInt(await fs.readFile(idFilePath, "utf-8"), 10);
        let data = await fs.readFile(blogFilePath, "utf-8");

        if (!data.trim()) {
            console.log("No blogs to process.");
            return;
        }

        const fileName = `${currentId}.txt`;
        const filePath = path.join(blogDataDir, fileName);

        await fs.writeFile(filePath, data.trim(), "utf-8");
        console.log(`Saved blog to ${fileName}`);

        // Update ID
        currentId++;
        await fs.writeFile(idFilePath, currentId.toString(), "utf-8");

        // Clear blogs.txt
        await fs.writeFile(blogFilePath, "", "utf-8");
        console.log("blogs.txt has been cleared.");
    } catch (err) {
        console.error("Error saving blogs:", err);
    }
}

// Route to handle blog submission
app.post("/submit-blog", async (req, res) => {
    const { content } = req.body;
    if (!content) return res.status(400).json({ message: "Content is required" });

    try {
        const timestamp = new Date().toISOString();
        const blogEntry = `[${timestamp}]\n${content}\n`;

        await fs.appendFile(blogFilePath, blogEntry, "utf-8");
        res.status(200).json({ message: "Blog submitted successfully!" });

        // Save blogs to individual files
        await saveBlogsToFiles();
    } catch (err) {
        console.error("Error saving blog:", err);
        res.status(500).json({ message: "Failed to save blog." });
    }
});

// Serve static files from the frontend folder
app.use(express.static(path.join(__dirname, "frontend")));

// Catch-all route for undefined endpoints
app.all("*", (req, res) => {
    res.status(405).json({ message: "Method Not Allowed" });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
