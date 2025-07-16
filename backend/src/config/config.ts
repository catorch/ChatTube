import dotenv from "dotenv";
dotenv.config();

if (!process.env.OPENAI_API_KEY) {
    console.error("Missing OpenAI API key. Please set it in the .env file");
    process.exit(1);
}