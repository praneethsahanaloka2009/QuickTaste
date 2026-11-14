import React from "react";
import { Plus, Trash2, SlidersHorizontal, Scaling, ListPlus } from "lucide-react";
import "./CustomizationEditor.css";

// Local React keys (separate from MongoDB IDs)
let localKey = 0;
const newKey = () => `custom-${++localKey}`;

const getGroupType = (name = "") => {
    const value = String(name).trim().toLowerCase();

    if(["size", "portion size", "portion sizes"].includes(value)){
        return "size";
    }

    if(value === "extra add-ons" || value === "extra addons" || value === "add-ons" || value === "addons"){
        return "addons";
    }

    return "other";
};

const createOption = (name = "", price = "0") => ({
    _key: newKey(),
    name,
    price,
    isAvailable: true
});

const createGroup = (type = "other") => {
    if(type === "size"){
        return {
            _key: newKey(),
            name: "Size",
            selectionType: "single",
            required: false,
            minSelect: 0,
            maxSelect: 1,
            options: [
                createOption("Regular", "0"),
                createOption("Large", "0")
            ]
        };
    }

    if(type === "addons"){
        return {
            _key: newKey(),
            name: "Extra Add-ons",
            selectionType: "multiple",
            required: false,
            minSelect: 0,
            maxSelect: 1,
            options: [
                createOption()
            ]
        };
    }

    return {
        _key: newKey(),
        name: "",
        selectionType: "single",
        required: false,
        minSelect: 0,
        maxSelect: 1,
        options: [
            createOption()
        ]
    };
};

// Convert saved MongoDB data to editable React state
export const normalizeCustomizationGroups = (groups = []) => {
    if(!Array.isArray(groups)){
        return [];
    }

    return groups.map((group) => {
        const type = getGroupType(group.name);

        return {
            _key: newKey(),
            _id: group._id,
            name: group.name || "",
            selectionType: type === "size" ? "single" : type === "addons" ? "multiple" : group.selectionType || "single",
            // Size and Add-ons are independent optional choices
            required: type === "other" ? Boolean(group.required) : false,
            minSelect: type === "other" ? Number(group.minSelect ?? 0) : 0,
            maxSelect: type === "size" ? 1 : Number(group.maxSelect ?? 1),
            options: Array.isArray(group.options) ? group.options.map((option) => ({
                _key: newKey(),
                _id: option._id,
                name: option.name || "",
                price: String(option.price ?? 0),
                isAvailable: option.isAvailable !== false
            })) : []
        };
    });
};

// Validate and prepare data for the existing backend
export const prepareCustomizationGroups = (groups = []) => {
    if(!Array.isArray(groups) || groups.length > 15){
        throw new Error("Maximum 15 customization groups allowed.");
    }

    const groupNames = new Set();
    const groupTypes = new Set();

    return groups.map((group) => {
        const name = String(group.name || "").trim();
        const type = getGroupType(name);

        if(!name || name.length > 100){
            throw new Error("Enter a valid customization group name.");
        }

        const nameKey = name.toLowerCase();

        if(groupNames.has(nameKey)){
            throw new Error(`Duplicate customization group: ${name}`);
        }

        groupNames.add(nameKey);

        if(type !== "other"){
            if(groupTypes.has(type)){
                throw new Error(
                    `Only one ${type === "size" ? "Portion Sizes" : "Extra Add-ons"} group is allowed.`
                );
            }
            groupTypes.add(type);
        }

        const selectionType = type === "size" ? "single" : type === "addons" ? "multiple" : group.selectionType;

        if(!["single", "multiple"].includes(selectionType)){
            throw new Error(`Invalid selection type in ${name}.`);
        }

        const required = type === "other" ? Boolean(group.required) : false;

        const minSelect = required ? 1 : 0;

        const maxSelect = selectionType === "single" ? 1 : Number(group.maxSelect);

        if(!Number.isInteger(maxSelect) || maxSelect < 1 || maxSelect > 30){
            throw new Error(`Invalid maximum selections in ${name}.`);
        }

        if(!Array.isArray(group.options) || group.options.length < 1 || group.options.length > 30){
            throw new Error(`${name} must have between 1 and 30 options.`);
        }

        if(maxSelect > group.options.length){
            throw new Error(`${name}: Maximum selections exceed the option count.`);
        }

        const optionNames = new Set();

        const options = group.options.map((option) => {
            const optionName = String(option.name || "").trim();

            if(!optionName || optionName.length > 100){
                throw new Error(`Enter a valid option name in ${name}.`);
            }

            const optionKey = optionName.toLowerCase();

            if(optionNames.has(optionKey)){
                throw new Error(`Duplicate option "${optionName}" in ${name}.`);
            }

            optionNames.add(optionKey);

            const rawPrice = String(option.price ?? "").trim();
            const price = Number(rawPrice);

            if(rawPrice === "" || !Number.isFinite(price) || price < 0 || !Number.isSafeInteger(Math.round(price * 100)) || Math.abs(price * 100 - Math.round(price * 100)) > 1e-7){
                throw new Error(`Enter a valid price for ${optionName}.`);
            }

            const cleanOption = {
                name: optionName,
                price: Math.round(price * 100) / 100,
                isAvailable: Boolean(option.isAvailable)
            };

            // Keep existing MongoDB IDs when editing
            if(option._id){
                cleanOption._id = String(option._id);
            }

            return cleanOption;
        });

        const availableCount = options.filter((option) => option.isAvailable).length;

        if(required && availableCount < minSelect){
            throw new Error(`${name}: A required group needs an available option.`);
        }

        const cleanGroup = {name, selectionType, required, minSelect, maxSelect, options};

        if(group._id){
            cleanGroup._id = String(group._id);
        }

        return cleanGroup;
    });
};

const CustomizationEditor = ({groups = [], onChange, disabled = false}) => {
    const sizeGroup = groups.find((group) => getGroupType(group.name) === "size");

    const addonsGroup = groups.find((group) => getGroupType(group.name) === "addons");

    const otherGroups = groups.filter((group) => getGroupType(group.name) === "other");

    const addGroup = (type) => {
        if(disabled || groups.length >= 15){
            return;
        }

        if(type !== "other" && groups.some((group) => getGroupType(group.name) === type)){
            return;
        }

        onChange([...groups, createGroup(type)]);
    };

    const removeGroup = (groupKey) => {
        if(disabled){
            return;
        }

        onChange(groups.filter((group) => group._key !== groupKey));
    };

    const updateGroup = (groupKey, field, value) => {
        if(disabled){
            return;
        }

        onChange(
            groups.map((group) => {
                if(group._key !== groupKey){
                    return group;
                }

                const updated = {
                    ...group,
                    [field]: value
                };

                if(field === "selectionType"){
                    updated.maxSelect = 1;
                }

                if(field === "required"){
                    updated.minSelect = value ? 1 : 0;
                }

                return updated;
            })
        );
    };

    const addOption = (groupKey) => {
        if(disabled){
            return;
        }

        onChange(
            groups.map((group) => {
                if(group._key !== groupKey){
                    return group;
                }

                if(group.options.length >= 30){
                    return group;
                }

                return {
                    ...group,
                    options: [
                        ...group.options,
                        createOption()
                    ]
                };
            })
        );
    };

    const updateOption = (groupKey, optionKey, field, value) => {
        if(disabled){
            return;
        }

        onChange(
            groups.map((group) => {
                if(group._key !== groupKey){
                    return group;
                }

                return {
                    ...group,
                    options: group.options.map((option) => option._key === optionKey ? { ...option, [field]: value } : option)
                };
            })
        );
    };

    const removeOption = (groupKey, optionKey) => {
        if(disabled){
            return;
        }

        onChange(
            groups.map((group) => {
                if(group._key !== groupKey){
                    return group;
                }

                const options = group.options.filter((option) => option._key !== optionKey);

                return {
                    ...group,
                    options,
                    maxSelect: group.selectionType === "single" ? 1 : Math.max(1, Math.min(Number(group.maxSelect) || 1, options.length))
                };
            })
        );
    };

    const renderGroup = (group, type) => {
        if(!group){
            return null;
        }

        const isSize = type === "size";
        const isAddons = type === "addons";
        const isOther = type === "other";

        const placeholder = isSize ? "e.g. Regular, Large" : isAddons ? "e.g. Extra Cheese, Extra Sauce" : group.name.toLowerCase().includes("spice") ? "e.g. Mild, Medium, Hot" : "Enter option name...";

        return (
            <div key={group._key} className={`custom-editor-group custom-editor-group-${type}`}>
                <div className="custom-editor-group-header">
                    <strong>
                        {isSize ? "Portion Size Options" : isAddons ? "Extra Add-on Options" : group.name || "Other Customization"}
                    </strong>

                    <button type="button" className="custom-editor-remove" disabled={disabled} onClick={() => removeGroup(group._key)}>
                        <Trash2 size={16}/>
                        Remove Group
                    </button>
                </div>

                {isOther && (
                    <div className="custom-editor-fields">
                        <label>
                            Group Name
                            <input type="text" value={group.name} maxLength={100} placeholder="e.g. Spice Level" disabled={disabled} onChange={(event) => updateGroup(group._key, "name", event.target.value)}/>
                        </label>

                        <label>
                            Selection Type
                            <select value={group.selectionType} disabled={disabled} onChange={(event) => updateGroup(group._key, "selectionType", event.target.value)}>
                                <option value="single">
                                    Single Choice
                                </option>
                                <option value="multiple">
                                    Multiple Choices
                                </option>
                            </select>
                        </label>
                    </div>
                )}

                <div className="custom-editor-settings">
                    {isOther ? (
                        <label className="custom-editor-checkbox">
                            <input type="checkbox" checked={group.required} disabled={disabled} onChange={(event) => updateGroup(group._key, "required", event.target.checked)}/>
                            Required Selection
                        </label>
                    ) : (
                        <span className="custom-editor-optional-label">
                            Optional — customer may skip
                        </span>
                    )}

                    {group.selectionType === "multiple" && (
                        <label className="custom-editor-max">
                            <input type="number" min="1" max="30" step="1" value={group.maxSelect} disabled={disabled} onChange={(event) => updateGroup(group._key, "maxSelect", event.target.value === "" ? "" : Number(event.target.value))}/>
                        </label>
                    )}
                </div>

                <div className="custom-editor-options-heading">
                    <strong>Available Options</strong>
                    <span>{group.options.length}/30</span>
                </div>

                <div className="custom-editor-options">
                    {group.options.map((option) => (
                        <div className="custom-editor-option" key={option._key}>
                            <label>
                                Option Name
                                <input type="text" value={option.name} maxLength={100} placeholder={placeholder} disabled={disabled} onChange={(event) => updateOption(group._key, option._key, "name", event.target.value)}/>
                            </label>

                            <label>
                                Extra Price ($)
                                <input type="number" min="0" step="0.01" value={option.price} disabled={disabled} onChange={(event) => updateOption(group._key, option._key, "price", event.target.value)}/>
                            </label>

                            <label className="custom-editor-available">
                                <input type="checkbox" checked={option.isAvailable} disabled={disabled} onChange={(event) => updateOption(group._key, option._key, "isAvailable", event.target.checked)}/>
                                Available
                            </label>

                            <button type="button" className="custom-editor-delete-option" title="Remove Option" aria-label={`Remove ${option.name || "option"}`} disabled={disabled} onClick={() => removeOption(group._key, option._key)}>
                                <Trash2 size={17}/>
                            </button>
                        </div>
                    ))}
                </div>

                <button type="button" className="custom-editor-add-option" disabled={disabled || group.options.length >= 30} onClick={() => addOption(group._key)}>
                    <Plus size={16}/>
                    Add Option
                </button>
            </div>
        );
    };

    return (
        <section className="custom-editor">
            <div className="custom-editor-heading">
                <div className="custom-editor-heading-text">
                    <SlidersHorizontal size={22}/>

                    <div>
                        <h3>Food Customization</h3>
                        <p>
                            Manage portion sizes and extras separately for each food product.
                        </p>
                    </div>
                </div>

                <span>{groups.length}/15 Groups</span>
            </div>

            {/* Portion Sizes */}
            <div className="custom-editor-section">
                <div className="custom-editor-section-heading">
                    <div className="custom-editor-section-icon">
                        <Scaling size={20}/>
                    </div>

                    <div>
                        <h4>Portion Sizes</h4>
                        <p>
                            Regular, Large or other serving sizes. Optional for customers.
                        </p>
                    </div>
                </div>

                {sizeGroup ? (
                    renderGroup(sizeGroup, "size")
                ) : (
                    <div className="custom-editor-section-empty">
                        <p>No portion sizes configured.</p>

                        <button type="button" className="custom-editor-add-group" disabled={disabled || groups.length >= 15} onClick={() => addGroup("size")}>
                            <Plus size={18}/>
                            Add Portion Sizes
                        </button>
                    </div>
                )}
            </div>

            {/* Extra Add-Ons */}
            <div className="custom-editor-section">
                <div className="custom-editor-section-heading">
                    <div className="custom-editor-section-icon">
                        <ListPlus size={20}/>
                    </div>

                    <div>
                        <h4>Extra Add-ons</h4>
                        <p>
                            Add optional toppings, sauces, cheese, protein and other extras.
                        </p>
                    </div>
                </div>

                {addonsGroup ? (
                    renderGroup(addonsGroup, "addons")
                ) : (
                    <div className="custom-editor-section-empty">
                        <p>No extra add-ons configured.</p>

                        <button type="button" className="custom-editor-add-group" disabled={disabled || groups.length >= 15} onClick={() => addGroup("addons")}>
                            <Plus size={18}/>
                            Add Extra Add-ons
                        </button>
                    </div>
                )}
            </div>

            {/* Other / Legacy Customization Groups */}
            {otherGroups.length > 0 && (
                <div className="custom-editor-section">
                    <div className="custom-editor-section-heading">
                        <div className="custom-editor-section-icon">
                            <SlidersHorizontal size={20}/>
                        </div>

                        <div>
                            <h4>Other Customizations</h4>
                            <p>
                                Existing spice levels and custom groups.
                            </p>
                        </div>
                    </div>

                    {otherGroups.map((group) => renderGroup(group, "other"))}
                </div>
            )}

            <button type="button" className="custom-editor-add-other" disabled={disabled || groups.length >= 15} onClick={() => addGroup("other")}>
                <Plus size={17}/>
                Add Other Customization
            </button>
        </section>
    );
};

export default CustomizationEditor