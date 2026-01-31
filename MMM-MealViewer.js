Module.register("MMM-MealViewer", {
    defaults: {
        schoolId: "",
        updateInterval: 14400000, // 4 hours, adjust as needed
        showTodayOnly: false, // set to true if you want to see only today
        startDay: 0, // 0 = Sunday, 1 = Monday, ..., 6 = Saturday (Ignored if showTodayOnly = true)
        endDay: 5, // 0 = Sunday, 1 = Monday, ..., 6 = Saturday (Ignored if showTodayOnly = true)
        maxDisplayDays: null, // Set a number of days to display, null = no limit (Ignored if showTodayOnly = true)
        showPastDays: false, // Set to true to show previous days menus
        hideTodayAfter: "14:00", // Specify the time after which to stop showing today's menu
        showBreakfast: true, // Set to false to not show breakfast menus
        showLunch: true, // Set to false to not show lunch menus
        collapseEmptyMeals: true, // hide days with no menu data
        lookAhead: false, // Set to true to show next week's menu when the current week ends
        testMode: false,
        testDate: null, // Format: "YYYY-MM-DD"
        filters: {
            breakfast: [],
            lunch: []
        },
        itemTypeFilters: {
            breakfast: [],
            lunch: []
        },
        exactNameFilters: {
            breakfast: [],
            lunch: []
        },
        startsWithFilters: {
            breakfast: [],
            lunch: []
        }
    },

    pad(n) {
        return String(n).padStart(2, "0");
    },
    ymd(d) {
        return `${d.getFullYear()}-${this.pad(d.getMonth() + 1)}-${this.pad(d.getDate())}`;
    },
    toLocalYMD(input) {
        const d = input instanceof Date ? input : new Date(input);
        return this.ymd(d);
    },

    start: function () {
        this.mealData = null;
        this.schoolLogo = null;
        this.schoolName = null;
        this.hasMenus = false;
        this.identifier =
      this.identifier || Math.random().toString(36).substring(2, 15);
        this.getData();
        this.scheduleUpdate();
    },

    getData: function () {
        this.sendSocketNotification("GET_MEAL_DATA", {
            identifier: this.identifier,
            schoolId: this.config.schoolId,
            filters: this.config.filters,
            itemTypeFilters: this.config.itemTypeFilters,
            exactNameFilters: this.config.exactNameFilters,
            startsWithFilters: this.config.startsWithFilters,
            startDay: this.config.startDay,
            endDay: this.config.endDay,
            showPastDays: this.config.showPastDays,
            hideTodayAfter: this.config.hideTodayAfter,
            showBreakfast: this.config.showBreakfast,
            showLunch: this.config.showLunch,
            lookAhead: this.config.lookAhead,
            testMode: this.config.testMode,
            testDate: this.config.testDate
        });
    },

    scheduleUpdate: function () {
        setInterval(() => {
            this.getData();
        }, this.config.updateInterval);
    },

    socketNotificationReceived: function (notification, payload) {
        if (
            notification === "MEAL_DATA" &&
      payload.identifier === this.identifier
        ) {
            this.mealData = payload.mealData;
            this.schoolLogo = payload.schoolLogo;
            this.schoolName = payload.schoolName;
            this.hasMenus = payload.hasMenus;
            this.updateDom();
        }
    },

    getDom: function () {
        var wrapper = document.createElement("div");
        wrapper.className = "meal-viewer";

        if (!this.mealData || this.mealData.length === 0) {
            // Return an empty wrapper if there's no data or no menus to show
            return wrapper;
        }

        var menu = document.createElement("div");

        const header = document.createElement("header");
        header.className = "module-header";

        if (this.schoolLogo) {
            const logo = document.createElement("img");
            logo.src = this.schoolLogo;
            logo.className = "school-logo";
            header.appendChild(logo);
        }

        const title = document.createElement("span");
        title.textContent = this.schoolName
            ? `${this.schoolName} Menu`
            : "School Menu";
        header.appendChild(title);

        menu.appendChild(header);

        const contentWrapper = document.createElement("div");
        contentWrapper.className = "module-content";

        let hasContent = false;

        let daysToRender = Array.isArray(this.mealData)
            ? this.mealData.slice()
            : [];

        // --- TODAY-ONLY FILTER (matches "TUESDAY, SEPTEMBER 2") ---
        if (this.config.showTodayOnly) {
            const now = new Date();

            // Build candidates in the SAME STYLE the module displays (uppercase, US-style, no year)
            const weekday = now
                .toLocaleDateString(undefined, { weekday: "long" })
                .toUpperCase(); // TUESDAY
            const month = now
                .toLocaleDateString(undefined, { month: "long" })
                .toUpperCase(); // SEPTEMBER
            const dayNum = String(now.getDate()); // 2
            const year = String(now.getFullYear());

            const TODAY_NO_YEAR = `${weekday}, ${month} ${dayNum}`; // "TUESDAY, SEPTEMBER 2"
            const TODAY_WITH_YR = `${TODAY_NO_YEAR}, ${year}`; // "TUESDAY, SEPTEMBER 2, 2025"
            const TODAY_ALT = `${month} ${dayNum}`; // "SEPTEMBER 2" (in case module omits weekday)

            const normalize = (s) =>
                String(s || "")
                    .toUpperCase()
                    .replace(/\s+/g, " ")
                    .trim();

            const candidates = [TODAY_NO_YEAR, TODAY_WITH_YR, TODAY_ALT].map(
                normalize
            );

            // Keep only entries whose .date looks like "today" in that style
            daysToRender = daysToRender.filter((d) => {
                const ds = normalize(d.date);
                return candidates.some((c) => ds === c || ds.includes(c));
            });

            // respect hideTodayAfter (only if we matched a "today" entry)
            if (
                daysToRender.length &&
        this.config.hideTodayAfter &&
        this.config.hideTodayAfter !== "never"
            ) {
                const [hh, mm = "0"] = String(this.config.hideTodayAfter).split(":");
                const cutoff = new Date(now);
                cutoff.setHours(parseInt(hh, 10) || 0, parseInt(mm, 10) || 0, 0, 0);
                if (now >= cutoff) daysToRender = [];
            }

            // collapseEmptyMeals (strings for this module)
            if (this.config.collapseEmptyMeals && daysToRender.length) {
                daysToRender = daysToRender.filter((d) => {
                    const hasBreakfast =
            this.config.showBreakfast &&
            typeof d.breakfast === "string" &&
            d.breakfast.trim() !== "";
                    const hasLunch =
            this.config.showLunch &&
            typeof d.lunch === "string" &&
            d.lunch.trim() !== "";
                    return hasBreakfast || hasLunch;
                });
            }

            if (!daysToRender.length) {
                const msg = document.createElement("div");
                msg.className = "dimmed small";
                msg.textContent = "No menu for today.";
                wrapper.appendChild(msg);
                return wrapper;
            }
        }
        // --- END TODAY-ONLY FILTER ---

        // --- MAX DISPLAY DAYS FILTER (from PR#2) ---
        // Apply maxDisplayDays limit if configured
        if (this.config.maxDisplayDays && this.config.maxDisplayDays > 0) {
            daysToRender = daysToRender.slice(0, this.config.maxDisplayDays);
        }
        // --- END MAX DISPLAY DAYS FILTER ---

        daysToRender.forEach((day) => {
            const hasBreakfast = day.breakfast && day.breakfast.trim() !== "";
            const hasLunch = day.lunch && day.lunch.trim() !== "";

            // Only create day menu if there's data to show
            if (
                (this.config.showBreakfast && hasBreakfast) ||
        (this.config.showLunch && hasLunch)
            ) {
                hasContent = true;
                var dayMenu = document.createElement("div");
                dayMenu.className = "day-menu";

                var dateElem = document.createElement("div");
                dateElem.className = "day-header";

                // Split date into weekday and date parts for flexible CSS styling
                // day.date format is "Monday, February 2"
                const dateParts = day.date.split(", ");
                if (dateParts.length >= 2) {
                    const weekdaySpan = document.createElement("span");
                    weekdaySpan.className = "day-weekday";
                    weekdaySpan.textContent = dateParts[0].toUpperCase();

                    const dateSpan = document.createElement("span");
                    dateSpan.className = "day-date";
                    dateSpan.textContent = dateParts.slice(1).join(", ").toUpperCase();

                    dateElem.appendChild(weekdaySpan);
                    dateElem.appendChild(dateSpan);
                } else {
                    // Fallback if format is unexpected
                    dateElem.textContent = day.date.toUpperCase();
                }

                dayMenu.appendChild(dateElem);

                if (this.config.showBreakfast && hasBreakfast) {
                    var breakfastElem = document.createElement("div");
                    breakfastElem.className = "meal-line";
                    breakfastElem.innerHTML = `<span class="meal-type">Breakfast:</span> ${day.breakfast}`;
                    dayMenu.appendChild(breakfastElem);
                }

                if (this.config.showLunch && hasLunch) {
                    var lunchElem = document.createElement("div");
                    lunchElem.className = "meal-line";
                    lunchElem.innerHTML = `<span class="meal-type">Lunch:</span> ${day.lunch}`;
                    dayMenu.appendChild(lunchElem);
                }

                contentWrapper.appendChild(dayMenu);
            }
        });

        if (hasContent) {
            menu.appendChild(contentWrapper);
            wrapper.appendChild(menu);
        }

        return wrapper;
    },

    getStyles: function () {
        return ["MMM-MealViewer.css"];
    }
});
