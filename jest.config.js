module.exports = {
    transform: {
        "^.+\\.ts?$": "ts-jest",
    },
    testEnvironment: "node",
    testRegex: "./src/.*\\.(test|spec)?\\.(js|ts)$",
    moduleFileExtensions: ["ts", "js", "json", "node"],
    moduleNameMapper: {
        "@/(.*)": "<rootDir>/src/$1",
    },
    roots: ["<rootDir>/src"],
};
