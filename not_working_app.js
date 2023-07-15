//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require("mongoose-findorcreate");

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: true}));
app.use(session({
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());

main().catch(err => console.log(err));

async function main() {
  await mongoose.connect('mongodb://127.0.0.1:27017/userDB');
const userSchema = new mongoose.Schema( {
    email: String,
    password: String,
    googleId: String,
    secret: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);
const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());
passport.serializeUser(function(user, done) {
    process.nextTick(function() {
        done(null, { id: user._id, username: user.username });
    });
});
passport.deserializeUser(function(user, done) {
    process.nextTick(function() {
        return done(null, user);
    });
});
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));


app.get("/", function(req, res){
    res.render("home");
});

app.route('/auth/google')

  .get(passport.authenticate('google', {

    scope: ['profile']

  }));

app.get('/auth/google/secrets', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect to secrets.
    res.redirect('/secrets');
  });

app.get("/login", function(req, res){
    res.render("login");
});

app.get("/register", function(req, res){

    res.render("register");
});

app.get("/secrets", function(req, res){
    User.find({"secret": {$ne: null}})
    .then(function(err, foundUsers){
        if (err){
            console.log(err);
        }else{
            if(foundUsers){
                res.render("secrets", {usersWithSecrets: foundUsers});
            }
        }
    });   
});

app.get("/submit",function(req,res){
    if(req.isAuthenticated()){
        res.render("submit");
    }
    else{
        res.redirect("/login");
    }
});

app.post("/submit",function(req,res){
    const submittedSecret= req.body.secret;
 
    User.findById(req.user.id)
        .then(function(founudUser){
            founudUser.secret=submittedSecret;
            founudUser.save()
                .then(()=>{
                    res.redirect("/secrets");
                });
        })
        .catch((err)=>{
            console.log(err);
        })
});

app.post("/register", async (req, res) => {
	try {
		const registerUser = await User.register(
                    {username: req.body.username}, req.body.password
                );
		if (registerUser) {
			passport.authenticate("local") (req, res, function() {
				res.redirect("/secrets");
			});
		} else {
			res.redirect("/register");
		}
	} catch (err) {
		res.send(err);
	}
});

app.post("/login", (req, res) => {
	const user = new User({
		username: req.body.username,
		password: req.body.password
	});
 
	req.login(user, (err) => {
		if (err) {
			console.log(err);
		} else {
			passport.authenticate("local")(req, res, function() {
				res.redirect("/secrets");
			});
		}
	});
});

app.get("/logout", function (req, res) {
    req.logout;
    res.redirect("/");
});




app.listen(3000, function(){
    console.log("Server started on port 3000");
});

};