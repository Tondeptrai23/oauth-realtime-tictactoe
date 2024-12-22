const OAuth2Strategy = require("passport-oauth2");
const db = require("../config/database");
const https = require("https");
const fetch = require("node-fetch");

const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
});

function initializePassport(passport) {
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    passport.deserializeUser(async (id, done) => {
        try {
            const user = await db.one(
                "SELECT * FROM ttt_users WHERE id = $1",
                id
            );
            done(null, user);
        } catch (err) {
            done(err);
        }
    });

    const strategy = new OAuth2Strategy(
        {
            authorizationURL: process.env.AUTH_SERVER_URL,
            tokenURL: process.env.AUTH_SERVER_TOKEN_URL,
            clientID: process.env.CLIENT_ID,
            clientSecret: process.env.CLIENT_SECRET,
            callbackURL: process.env.REDIRECT_URI,
            scope: ["profile:basic", "profile:full"],
            passReqToCallback: true,
            state: false,
        },
        async function (req, accessToken, refreshToken, params, profile, done) {
            try {
                const response = await fetch(
                    process.env.AUTH_SERVER_PROFILE_URL,
                    {
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                        },
                        agent: httpsAgent,
                        method: "GET",
                    }
                );

                if (!response.ok) {
                    throw new Error(`Profile fetch failed: ${response.status}`);
                }

                const profileData = await response.json();

                let user = await db.oneOrNone(
                    "SELECT * FROM ttt_users WHERE oauth_id = '$1'",
                    [profileData.id]
                );

                if (!user) {
                    user = await db.one(
                        `INSERT INTO ttt_users (oauth_id, username, avatar_url) 
                         VALUES ($1, $2, $3) RETURNING *`,
                        [
                            profileData.id,
                            profileData.username,
                            profileData.avatar_url,
                        ]
                    );
                }

                return done(null, user, {
                    accessToken: accessToken,
                    scope: params.scope,
                });
            } catch (err) {
                console.error("Strategy callback error:", err);
                return done(err);
            }
        }
    );

    strategy._oauth2._customHeaders = {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
    };

    const oauth2 = strategy._oauth2;
    oauth2._agent = new https.Agent({
        rejectUnauthorized: false,
    });

    oauth2.getOAuthAccessToken = function (code, params, callback) {
        params = {
            client_id: oauth2._clientId,
            client_secret: oauth2._clientSecret,
            code: code,
            grant_type: "authorization_code",
            redirect_uri: process.env.REDIRECT_URI,
            ...params,
        };

        const postData = new URLSearchParams(params).toString();

        oauth2._request(
            "POST",
            oauth2._getAccessTokenUrl(),
            {
                "Content-Type": "application/x-www-form-urlencoded",
                "Content-Length": postData.length,
                Accept: "application/json",
            },
            postData,
            null,
            (error, data, response) => {
                if (error) {
                    console.error("Token request failed:", error);
                    return callback(error);
                }

                console.log("Token response:", data);

                let results;
                try {
                    results = JSON.parse(data);
                } catch (e) {
                    return callback(new Error("Invalid JSON response"));
                }

                callback(
                    null,
                    results.access_token,
                    results.refresh_token,
                    results
                );
            }
        );
    };

    passport.use(strategy);
}

module.exports = initializePassport;
