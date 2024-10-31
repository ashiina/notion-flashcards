const https = require('https');

// Helper function to query the Notion API and handle pagination
async function queryNotionDatabase(cursor = null) {
    console.log('queryNotionDatabase...');
    const options = {
        hostname: 'api.notion.com',
        path: '/v1/databases/9a194ec8771e49f2b7a16444280f39f0/query',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.NOTION_API_TOKEN}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28'
        }
    };

    return new Promise((resolve, reject) => {
        let postData = cursor ? JSON.stringify({ start_cursor: cursor }) : JSON.stringify({});
        
        const req = https.request(options, (res) => {
            let data = '';

            // Collect response data
            res.on('data', (chunk) => {
                data += chunk;
            });

            // Process the entire response when it's complete
            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(data);
                    resolve(parsedData);
                } catch (error) {
                    reject(`Error parsing data: ${error.message}`);
                }
            });
        });

        req.on('error', (e) => {
            reject(`Error with request: ${e.message}`);
        });

        req.write(postData);
        req.end();
    });
}

// Main Lambda handler to fetch and return all pages
exports.handler = async (event) => {
    let allResults = [];
    let cursor = null;
    let hasMore = true;

    try {
        // Continue querying the database until there are no more pages
        while (hasMore) {
            const response = await queryNotionDatabase(cursor);

            // Map and extract desired fields from each result
            const filteredResults = response.results.map(item => ({
                Name: item.properties?.Name?.title[0]?.text?.content || '',
                Meaning: item.properties?.Meaning?.rich_text[0]?.text?.content || '',
                Past: item.properties?.Past?.rich_text[0]?.text?.content || '',
                Comment: item.properties?.Comment?.rich_text[0]?.text?.content || ''
            }));

            // Accumulate the filtered results
            allResults = allResults.concat(filteredResults);

            // Check if there's more data to paginate through
            hasMore = response.has_more;
            cursor = response.next_cursor;
            console.log(`hasMore: {hasMore} , cursor: {cursor}`);

        }

        // Return all the accumulated results
        return {
            statusCode: 200,
            body: JSON.stringify(allResults),
            headers: {
                'Access-Control-Allow-Origin': '*', // Allow all origins
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'OPTIONS,POST,GET' // Adjust methods if needed
            },
        };

    } catch (error) {
        return {
            statusCode: 500,
            body: `Error: ${error}`,
        };
    }
};