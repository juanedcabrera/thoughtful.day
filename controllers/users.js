// required packages
const express = require("express");
const router = express.Router();
const db = require("../models");
const bcrypt = require("bcrypt");
const cryptoJs = require("crypto-js");
const methodOverride = require("method-override");

// GET /users/new -- show route for a form that creates a new user (sign up for the app)
router.get("/new", (req, res) => {
  if (res.locals.user) {
    res.redirect("./main");
  } else {
    res.render("users/new.ejs");
  }
});

// GET /users/login -- show route for a form that lets a user login
router.get("/login", (req, res) => {
  if (res.locals.user) {
    res.redirect("./main");
  } else {
    res.render("users/login.ejs", { message: req.query.message });
  }
});

// Define an array of template names
const templates = ["freeform", "gratitude", "accomplishment"];

// GET /users/profile -- take user to their profile page
router.get("/profile", (req, res) => {
  const user = res.locals.user;
  const selectedTemplates = user.templates || []; // Get the user's selected templates, if any
  res.render("users/profile.ejs", { user, selectedTemplates, templates, message: req.query.message });
  });

// POST /users -- CREATE a new user from the form @ GET /users/new
router.post("/", async (req, res) => {
  try {
    // This is to get the offset hours to put into the user table
    const date = new Date();
    const offsetInMinutes = date.getTimezoneOffset();
    const offsetHours = Math.abs(offsetInMinutes) / 60;
    const offsetMinutes = Math.abs(offsetInMinutes) % 60;
    const sign = offsetInMinutes > 0 ? '-' : '+';
    const formattedOffset = sign + pad(offsetHours)
    
    function pad(num) {
      return String(num).padStart(2, '0');
    }
    
  
    
    
    
    // do a find or create with the user's given email
    const [newUser, created] = await db.user.findOrCreate({
      where: {
        email: req.body.email,
      },
      defaults: {
        first_name: req.body.first_name,
        last_name: req.body.last_name,
        template: {"userSelectedTemplates": ["freeform"]},
        current_streak: 0,
        longest_streak: 0,
        timezone: formattedOffset,
        password: bcrypt.hashSync(req.body.password, 12),

      },
    });

    if (!created) {
      // if the user's returns as found -- don't let them sign up
      // console.log("user account exists");
      // instead redirect them to the log in page
      res.redirect(
        `/users/login?message=${encodeURIComponent("Please login to your account to continue 🙈")}`
      );
    } else {
      // encypt the logged in user's id
      const encryptedPk = cryptoJs.AES.encrypt(
        newUser.id.toString(),
        process.env.ENC_KEY
      );
      // set encrypted id as a cookie
      res.cookie("userId", encryptedPk.toString(), {
        httpOnly: true,
        sameSite: 'lax',
      });
      // redirect user
      res.redirect("/users/main");
    }
  } catch (error) {
    console.log(error);
    res.redirect("/");
  }
});

// POST /users/login -- authenticate a user's credentials
router.post("/login", async (req, res) => {
  try {
    // search for the user's email in the db
    const foundUser = await db.user.findOne({
      where: {
        email: req.body.email,
      },
    });
    const failedLoginMessage = "Incorrect email or password 🙁";
    if (!foundUser) {
      // if the user's email is not found -- do not let them login
      console.log("user not found");
      res.redirect("/users/login?message=" + encodeURIComponent(failedLoginMessage));
    } else if (!bcrypt.compareSync(req.body.password, foundUser.password)) {
      console.log("incorrect password");
      // if the user exists but they have the wrong password -- do not let them login
      res.redirect("/users/login?message=" + encodeURIComponent(failedLoginMessage));
    } else {
      // if the user exists, they know the right password -- log them in
      const encryptedPk = cryptoJs.AES.encrypt(
        foundUser.id.toString(),
        process.env.ENC_KEY
      );
      // set encrypted id as a cookie
      res.cookie("userId", encryptedPk.toString(), {
        httpOnly: true,
        sameSite: 'lax',
      });
      // redirect user
      res.redirect("/users/main");
    }
  } catch (error) {
    console.log(error);
    res.redirect("/");
  }
});

// GET /users/logout -- log out the current user
router.get("/logout", (req, res) => {
  console.log("logging user out!");
  res.clearCookie("userId");
  res.redirect("/");
});

// GET /users/main -- show authorized users their main page
router.get("/main", async (req, res) => {
  try {
    // check for the userId cookie
    const encryptedPk = req.cookies.userId;
    if (!encryptedPk) {
      // if the cookie is not present, redirect the user to the login page
      res.redirect(
        `/users/login?message=${encodeURIComponent("You are not authorized to view that page. Please authenticate to continue 😎")}`
      );
      return;
    }

    // decrypt the user ID and find the user in the database
    const userId = parseInt(
      cryptoJs.AES.decrypt(encryptedPk, process.env.ENC_KEY).toString(
        cryptoJs.enc.Utf8
      )
    );
    const user = await db.user.findByPk(userId);
    if (!user) {
      // if the user is not found in the database, redirect to the login page
      res.redirect(
        `/users/login?message=${encodeURIComponent("You are not authorized to view that page. Please authenticate to continue 😎")}`
      );
      return;
    }

    const allEntries = await res.locals.user.getEntries()
    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth();
      if (allEntries === undefined) {
        allEntries = []
      }

    // Get the user's most recent post
    const lastPost = await db.entry.findOne({
      where: { userId: user.id },
      order: [["createdAt", "DESC"]],
    });

    if (!lastPost) {
      message = "Welcome Main 🎉";
      // User has never posted before
      res.render("users/main.ejs", {
        user,
        allEntries,
        year,
        month
      });
      return;
    }

    // Calculate current streak and longest streak
    const currentDate = new Date();
    const lastPostDate = new Date(lastPost.createdAt);
    const timeDiff = currentDate.getTime() - lastPostDate.getTime();
    const dayDiff = Math.floor(timeDiff / (1000 * 3600 * 24));
    const currentStreak = dayDiff === 1 ? user.current_streak + 1 : 0;
    const longestStreak = Math.max(user.longest_streak || 0, currentStreak);

    await db.user.update(
      { current_streak: currentStreak, longest_streak: longestStreak },
      { where: { id: user.id } }
    );
    message = "Let's work on that streak 📈";


    res.render("users/main.ejs", { user, currentStreak, longestStreak, allEntries, year, month });
  } catch (err) {
    console.log(err);
    res.status(500).send("Internal Server Error");
  }
});

// PUT route to update the user's password and commitment
router.put("/profile", async (req, res) => {
  try {
    const { newPassword, motivation, reward, deterrent, signature, my_file, userSelectedTemplates, newTimezone } =
      req.body;
    const { user } = res.locals;

    let message;

    if (newPassword) {
      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 12);
    
      // Update password in db
      await db.user.update(
        { password: hashedPassword }, { where: { id: user.id } }
      );
    
      message = "New password created 🥳";
    }
    
    if (motivation || reward || deterrent || signature) {
      // Combine commitment parts into JSON object
      const commitment = { motivation, reward, deterrent, signature };
      // console.log(commitment)
    
      // Update commitment in db
      await db.user.update({ commitment }, { where: { id: user.id } });
    
      message = "Commitment updated 🥳";
    }
    
    if (my_file) {
      await db.user.update(
        { img: req.body.my_file }, { where: { id: user.id } });

      message = "Profile Pic Updated 🎉";
    }

    if (newTimezone) {
      // Update password in db
      await db.user.update(
        { timezone: newTimezone }, { where: { id: user.id } }
      );
    
      message = "Timezone updated 🥳";
    }
    
    if (userSelectedTemplates) {
      // Handle single or multiple selected templates
      let templates;
      if (Array.isArray(userSelectedTemplates)) {
        templates = { userSelectedTemplates: [...userSelectedTemplates] };
      } else {
        templates = { userSelectedTemplates: [userSelectedTemplates] };
      }
      
      // Update user's selected templates
      await db.user.update({ template: templates }, { where: { id: user.id } });
      message = "Template saved successfully 🎉";
    }
    
    

res.redirect(`/users/profile?message=${encodeURIComponent(message)}`);
  } catch (err) {
    console.log(err);
    res.status(500).send("Internal Server Error");
  }
});


// router.get('/main', async (req, res) => {
//   const allEntries = await db.entry.findAll();
//   res.render('calendar', { allEntries });
// });

// export the router instance
module.exports = router;
